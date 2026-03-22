"""AI Ontology Generator — natural language → structured ontology."""

import json
import logging
import re
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ontology import ObjectType, PropertyDefinition, LinkType, ActionType
from app.services.llm_provider import get_llm_client, chat_completion

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior ontology architect. The user describes a business domain; you produce a precise, clean ontology schema.

Return a SINGLE valid JSON object (no markdown fences, no explanation) with this exact schema:

{
  "object_types": [
    {
      "name": "snake_case_api_name",
      "display_name": "Human Readable Name",
      "description": "one-sentence purpose",
      "icon": "cube",
      "color": "#HEX",
      "primary_key_property": "code_or_id_property_name",
      "properties": [
        {"name": "snake_case", "display_name": "Name", "data_type": "string|integer|float|boolean|datetime|json", "description": "...", "required": true, "order": 0}
      ]
    }
  ],
  "link_types": [
    {
      "name": "snake_case_verb_phrase",
      "display_name": "Human Name",
      "description": "what this relationship means",
      "source_type_name": "MUST match an object_type name above",
      "target_type_name": "MUST match a DIFFERENT object_type name above",
      "cardinality": "one_to_one|one_to_many|many_to_many"
    }
  ],
  "action_types": [
    {
      "name": "snake_case",
      "display_name": "Human Name",
      "description": "...",
      "object_type_name": "MUST match an object_type name above",
      "logic_type": "edit_object|create_object|delete_object",
      "parameters": {"parameters": [{"name":"param","type":"string","required":true}]},
      "logic_config": {}
    }
  ]
}

STRICT RULES — violations will be rejected:

Object Types:
- 3-8 object types max (focus on core domain entities, avoid over-modeling).
- Each must have a primary_key_property that uniquely identifies instances (e.g. "code", "order_number").
- Each must have 3-8 meaningful properties. Always include the primary_key as the first property.
- Use distinct, visually pleasant colors. No two types share the same color.
- All names are lowercase snake_case, display_name in user's language.

Link Types (CRITICAL — this is where most errors happen):
- ONLY create links between DIFFERENT object types. NEVER link a type to itself.
- source_type_name and target_type_name MUST exactly match a name from object_types array.
- If the user's input is a command (e.g. "link X, Y, Z together"), infer the object types from the named entities and generate the appropriate link_types between them.
- Each link name must be a clear verb phrase describing the direction (e.g. "supplier_supplies_part", "order_contains_part").
- Do NOT create redundant/inverse links (if A→B exists, don't also create B→A for the same relationship).
- Do NOT create links between types that have no real business relationship.
- Typical count: roughly equal to object_type count (e.g. 5 types → 4-6 links).
- Prefer one_to_many over many_to_many unless truly needed.

Action Types:
- 1-2 meaningful actions per object type (the most common operations).
- Always include a target_id parameter for edit/delete operations.

EXAMPLE for "供应链管理: 供应商、零件、采购订单":
{
  "object_types": [
    {"name":"supplier","display_name":"供应商","description":"零部件供应商","icon":"shop","color":"#1890ff","primary_key_property":"supplier_code","properties":[
      {"name":"supplier_code","display_name":"编码","data_type":"string","description":"唯一编码","required":true,"order":0},
      {"name":"name","display_name":"名称","data_type":"string","description":"供应商名称","required":true,"order":1},
      {"name":"country","display_name":"国家","data_type":"string","description":"所在国家","required":false,"order":2},
      {"name":"rating","display_name":"评级","data_type":"string","description":"A/B/C评级","required":false,"order":3}
    ]},
    {"name":"part","display_name":"零件","description":"零部件","icon":"tool","color":"#50C878","primary_key_property":"part_number","properties":[
      {"name":"part_number","display_name":"零件号","data_type":"string","description":"唯一零件号","required":true,"order":0},
      {"name":"name","display_name":"名称","data_type":"string","description":"零件名称","required":true,"order":1},
      {"name":"category","display_name":"类别","data_type":"string","description":"零件类别","required":false,"order":2},
      {"name":"unit_price","display_name":"单价","data_type":"float","description":"采购单价","required":false,"order":3}
    ]},
    {"name":"purchase_order","display_name":"采购订单","description":"采购订单","icon":"file-text","color":"#FF6B6B","primary_key_property":"po_number","properties":[
      {"name":"po_number","display_name":"订单号","data_type":"string","description":"唯一订单号","required":true,"order":0},
      {"name":"quantity","display_name":"数量","data_type":"integer","description":"订购数量","required":true,"order":1},
      {"name":"status","display_name":"状态","data_type":"string","description":"待审批/已审批/已到货","required":true,"order":2},
      {"name":"order_date","display_name":"下单日期","data_type":"datetime","description":"下单日期","required":false,"order":3}
    ]}
  ],
  "link_types": [
    {"name":"supplier_supplies_part","display_name":"供应零件","description":"供应商供应哪些零件","source_type_name":"supplier","target_type_name":"part","cardinality":"one_to_many"},
    {"name":"order_purchases_part","display_name":"订购零件","description":"订单对应的零件","source_type_name":"purchase_order","target_type_name":"part","cardinality":"one_to_many"},
    {"name":"order_from_supplier","display_name":"供应商订单","description":"订单来自哪个供应商","source_type_name":"purchase_order","target_type_name":"supplier","cardinality":"many_to_one"}
  ],
  "action_types": [
    {"name":"approve_order","display_name":"审批订单","description":"审批采购订单","object_type_name":"purchase_order","logic_type":"edit_object","parameters":{"parameters":[{"name":"target_id","type":"string","required":true}]},"logic_config":{"target":"{{target_id}}","updates":{"status":"已审批"}}},
    {"name":"reject_order","display_name":"驳回订单","description":"驳回采购订单","object_type_name":"purchase_order","logic_type":"edit_object","parameters":{"parameters":[{"name":"target_id","type":"string","required":true},{"name":"reason","type":"string","required":false}]},"logic_config":{"target":"{{target_id}}","updates":{"status":"已驳回"}}}
  ]
}

Return ONLY the JSON. No text before or after."""

COLORS = [
    "#4A90D9", "#50C878", "#FF6B6B", "#FFB347", "#9B59B6",
    "#1ABC9C", "#E74C3C", "#3498DB", "#F39C12", "#2ECC71",
    "#E67E22", "#8E44AD", "#16A085", "#D35400", "#2980B9",
]

COMMAND_VERB_MAP = {
    "删除": "delete_object",
    "删掉": "delete_object",
    "移除": "delete_object",
    "清理": "delete_object",
    "edit": "edit_object",
    "update": "edit_object",
    "modify": "edit_object",
    "编辑": "edit_object",
    "修改": "edit_object",
    "更新": "edit_object",
    "create": "create_object",
    "add": "create_object",
    "新增": "create_object",
    "创建": "create_object",
    "添加": "create_object",
}

ZH_ENTITY_NAME_MAP = {
    "人员": "person",
    "员工": "employee",
    "用户": "user",
    "部门": "department",
    "项目": "project",
    "角色": "role",
    "权限": "permission",
    "客户": "customer",
    "订单": "order",
    "供应商": "supplier",
    "零件": "part",
    "工厂": "plant",
    "仓库": "warehouse",
    "商品": "product",
}


def _infer_logic_type(description: str) -> str:
    lowered = description.lower()
    for verb, logic_type in COMMAND_VERB_MAP.items():
        if verb in description or verb in lowered:
            return logic_type
    return "edit_object"


def _to_snake_case(label: str, index: int) -> str:
    cleaned = label.strip()
    if not cleaned:
        return f"entity_{index + 1}"

    if cleaned in ZH_ENTITY_NAME_MAP:
        return ZH_ENTITY_NAME_MAP[cleaned]

    ascii_name = re.sub(r"[^a-zA-Z0-9]+", "_", cleaned).strip("_").lower()
    if ascii_name:
        return ascii_name

    return f"entity_{index + 1}"


def _extract_entity_labels(description: str) -> list[str]:
    normalized = description.strip()
    if not normalized:
        return []

    for old, new in {
        "、": ",",
        "，": ",",
        "；": ",",
        ";": ",",
        "。": ",",
        "\n": ",",
        "以及": ",",
        "及": ",",
        "和": ",",
        "and": ",",
    }.items():
        normalized = normalized.replace(old, new)

    parts = [part.strip() for part in normalized.split(",")]
    cleaned_parts: list[str] = []
    for part in parts:
        part = re.sub(
            r"^(帮我|请|需要|我要|想要|把)?\s*(删除|删掉|移除|清理|编辑|修改|更新|创建|新增|添加|管理|维护)\s*",
            "",
            part,
            flags=re.IGNORECASE,
        ).strip()
        part = re.sub(r"\s+", " ", part).strip(" .")
        if not part or len(part) > 20:
            continue
        cleaned_parts.append(part)

    seen: set[str] = set()
    labels: list[str] = []
    for label in cleaned_parts:
        if label in seen:
            continue
        seen.add(label)
        labels.append(label)
        if len(labels) >= 8:
            break
    return labels


def _build_fallback_object_types(description: str) -> list[dict]:
    labels = _extract_entity_labels(description)
    object_types: list[dict] = []

    for index, label in enumerate(labels):
        api_name = _to_snake_case(label, index)
        code_name = f"{api_name}_code" if not api_name.startswith("entity_") else "code"
        object_types.append({
            "name": api_name,
            "display_name": label,
            "description": f"由命令式输入自动补全的 {label} 类型",
            "icon": "cube",
            "color": COLORS[index % len(COLORS)],
            "primary_key_property": code_name,
            "properties": [
                {
                    "name": code_name,
                    "display_name": "编码",
                    "data_type": "string",
                    "description": f"{label}唯一标识",
                    "required": True,
                    "order": 0,
                },
                {
                    "name": "name",
                    "display_name": "名称",
                    "data_type": "string",
                    "description": f"{label}名称",
                    "required": True,
                    "order": 1,
                },
                {
                    "name": "status",
                    "display_name": "状态",
                    "data_type": "string",
                    "description": f"{label}当前状态",
                    "required": False,
                    "order": 2,
                },
            ],
        })

    return object_types


def _ensure_plan_has_object_types(plan: dict, description: str) -> dict:
    object_types = plan.get("object_types") or []
    if object_types:
        return plan

    fallback_object_types = _build_fallback_object_types(description)
    if not fallback_object_types:
        return plan

    logic_type = _infer_logic_type(description)
    warnings = list(plan.get("_warnings") or [])
    warnings.append("AI 未生成对象类型，已根据输入自动补全基础对象类型草稿")

    plan["object_types"] = fallback_object_types
    if not plan.get("action_types"):
        plan["action_types"] = [
            {
                "name": f"{logic_type.replace('_object', '')}_{ot['name']}",
                "display_name": f"{ot['display_name']}{'删除' if logic_type == 'delete_object' else '编辑' if logic_type == 'edit_object' else '创建'}",
                "description": f"由命令式输入自动补全的{ot['display_name']}操作",
                "object_type_name": ot["name"],
                "logic_type": logic_type,
                "parameters": {"parameters": [{"name": "target_id", "type": "string", "required": True}]},
                "logic_config": {"target": "{{target_id}}"} if logic_type != "create_object" else {},
            }
            for ot in fallback_object_types
        ]
    plan["_warnings"] = warnings
    return plan


def _validate_plan(plan: dict) -> dict:
    """Validate and fix the generated ontology plan.

    Removes invalid links, deduplicates, and ensures referential integrity.
    Returns the cleaned plan with a 'warnings' list.
    """
    warnings: list[str] = []

    ot_names: set[str] = set()
    for ot in plan.get("object_types", []):
        if not ot.get("name"):
            continue
        ot_names.add(ot["name"])

    valid_links: list[dict] = []
    seen_link_pairs: set[tuple[str, str]] = set()

    for lt in plan.get("link_types", []):
        src = lt.get("source_type_name", "")
        tgt = lt.get("target_type_name", "")
        name = lt.get("name", "")

        if not src or not tgt or not name:
            warnings.append(f"跳过不完整的关联: {name}")
            continue

        if src not in ot_names:
            warnings.append(f"关联 '{name}' 的源类型 '{src}' 不存在，已移除")
            continue

        if tgt not in ot_names:
            warnings.append(f"关联 '{name}' 的目标类型 '{tgt}' 不存在，已移除")
            continue

        if src == tgt:
            warnings.append(f"关联 '{name}' 是自引用 ({src}→{src})，已移除")
            continue

        pair = (min(src, tgt), max(src, tgt))
        if pair in seen_link_pairs:
            warnings.append(f"关联 '{name}' ({src}→{tgt}) 与已有关联重复，已移除")
            continue

        seen_link_pairs.add(pair)
        valid_links.append(lt)

    plan["link_types"] = valid_links

    valid_actions: list[dict] = []
    seen_action_names: set[str] = set()
    for at in plan.get("action_types", []):
        name = at.get("name", "")
        obj_name = at.get("object_type_name", "")

        if not name or name in seen_action_names:
            continue
        seen_action_names.add(name)

        if obj_name and obj_name not in ot_names:
            warnings.append(f"操作 '{name}' 的目标类型 '{obj_name}' 不存在，已修正为空")
            at["object_type_name"] = ""

        valid_actions.append(at)

    plan["action_types"] = valid_actions
    plan["_warnings"] = warnings

    return plan


async def generate_ontology(
    db: AsyncSession,
    description: str,
    provider_id: Optional[str] = None,
) -> dict:
    """Call LLM with business description, return validated ontology plan."""
    client, model = await get_llm_client(db, provider_id)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": description},
    ]

    response = await chat_completion(client, model, messages, temperature=0.15)
    content = response.get("content", "").strip()

    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    start = content.find("{")
    end = content.rfind("}") + 1
    if start >= 0 and end > start:
        content = content[start:end]

    try:
        plan = json.loads(content)
    except json.JSONDecodeError as e:
        logger.error("LLM returned invalid JSON: %s", content[:500])
        raise ValueError(f"AI 返回格式错误，请重试: {e}") from e

    if "object_types" not in plan:
        raise ValueError("AI 返回缺少 object_types 字段")

    plan = _ensure_plan_has_object_types(plan, description)
    plan = _validate_plan(plan)

    if plan.get("_warnings"):
        logger.info("Ontology plan validation warnings: %s", plan["_warnings"])

    return plan


async def apply_ontology_plan(db: AsyncSession, plan: dict) -> dict:
    """Persist a validated ontology plan to the database.

    Returns summary of created entities.
    """
    plan.pop("_warnings", None)

    plan = _validate_plan(plan)

    created = {"object_types": [], "link_types": [], "action_types": []}
    name_to_id: dict[str, str] = {}

    existing = await db.execute(select(ObjectType.name))
    existing_names: set[str] = {row[0] for row in existing.fetchall()}

    for i, ot_data in enumerate(plan.get("object_types", [])):
        if ot_data["name"] in existing_names:
            logger.warning("Skipping duplicate object type: %s", ot_data["name"])
            continue
        color = ot_data.get("color") or COLORS[i % len(COLORS)]
        obj_type = ObjectType(
            name=ot_data["name"],
            display_name=ot_data.get("display_name", ot_data["name"]),
            description=ot_data.get("description"),
            icon=ot_data.get("icon", "cube"),
            color=color,
            primary_key_property=ot_data.get("primary_key_property"),
        )
        db.add(obj_type)
        await db.flush()

        for prop in ot_data.get("properties", []):
            db.add(PropertyDefinition(
                object_type_id=obj_type.id,
                name=prop["name"],
                display_name=prop.get("display_name", prop["name"]),
                data_type=prop.get("data_type", "string"),
                description=prop.get("description"),
                required=prop.get("required", False),
                indexed=prop.get("indexed", False),
                order=prop.get("order", 0),
            ))

        await db.flush()
        name_to_id[ot_data["name"]] = obj_type.id
        created["object_types"].append({
            "id": obj_type.id,
            "name": ot_data["name"],
            "display_name": obj_type.display_name,
            "properties_count": len(ot_data.get("properties", [])),
        })

    # Backfill name_to_id for pre-existing object types referenced by link_types/action_types.
    # Without this, any link whose source or target already existed in the DB
    # would be silently dropped because name_to_id only contains newly created types.
    referenced_names: set[str] = set()
    for lt_data in plan.get("link_types", []):
        referenced_names.add(lt_data.get("source_type_name", ""))
        referenced_names.add(lt_data.get("target_type_name", ""))
    for at_data in plan.get("action_types", []):
        referenced_names.add(at_data.get("object_type_name", ""))

    missing_names = (referenced_names - set(name_to_id.keys())) & existing_names
    if missing_names:
        rows = await db.execute(
            select(ObjectType.name, ObjectType.id).where(ObjectType.name.in_(missing_names))
        )
        for row_name, row_id in rows.fetchall():
            name_to_id[row_name] = row_id

    existing_lt = await db.execute(select(LinkType.name))
    existing_lt_names: set[str] = {row[0] for row in existing_lt.fetchall()}
    existing_at = await db.execute(select(ActionType.name))
    existing_at_names: set[str] = {row[0] for row in existing_at.fetchall()}

    for lt_data in plan.get("link_types", []):
        if lt_data["name"] in existing_lt_names:
            continue
        src_id = name_to_id.get(lt_data.get("source_type_name", ""))
        tgt_id = name_to_id.get(lt_data.get("target_type_name", ""))
        if not src_id or not tgt_id:
            continue
        lt = LinkType(
            name=lt_data["name"],
            display_name=lt_data.get("display_name", lt_data["name"]),
            description=lt_data.get("description"),
            source_type_id=src_id,
            target_type_id=tgt_id,
            cardinality=lt_data.get("cardinality", "many_to_many"),
        )
        db.add(lt)
        await db.flush()
        created["link_types"].append({
            "id": lt.id,
            "name": lt_data["name"],
            "display_name": lt.display_name,
        })

    for at_data in plan.get("action_types", []):
        if at_data["name"] in existing_at_names:
            continue
        ot_id = name_to_id.get(at_data.get("object_type_name", ""))
        action = ActionType(
            name=at_data["name"],
            display_name=at_data.get("display_name", at_data["name"]),
            description=at_data.get("description"),
            object_type_id=ot_id,
            logic_type=at_data.get("logic_type", "edit_object"),
            parameters=at_data.get("parameters", {}),
            logic_config=at_data.get("logic_config", {}),
        )
        db.add(action)
        await db.flush()
        created["action_types"].append({
            "id": action.id,
            "name": at_data["name"],
            "display_name": action.display_name,
        })

    return created
