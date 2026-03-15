import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ontology import ActionType, ObjectType
from app.models.instance import ObjectInstance

logger = logging.getLogger("uvicorn.error")


class ActionError(Exception):
    pass


def _render_template(template: str, params: dict[str, Any]) -> str:
    """Replace {{var}} placeholders with actual parameter values."""
    def replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        if key in params:
            return str(params[key])
        return match.group(0)
    return re.sub(r"\{\{(.+?)\}\}", replacer, template)


def _validate_params(parameters_schema: list[dict], provided: dict[str, Any]) -> dict[str, Any]:
    """Validate and coerce provided parameters against the schema."""
    validated: dict[str, Any] = {}
    for param_def in parameters_schema:
        name = param_def["name"]
        required = param_def.get("required", False)
        default = param_def.get("default")
        enum = param_def.get("enum")

        if name not in provided and required and default is None:
            raise ActionError(f"Missing required parameter: {name}")

        value = provided.get(name, default)
        if value is None and not required:
            continue

        if enum and value not in enum:
            raise ActionError(f"Parameter '{name}' must be one of {enum}, got '{value}'")

        validated[name] = value
    return validated


async def execute_action(
    db: AsyncSession,
    action_type_id: str,
    params: dict[str, Any],
    *,
    dry_run: bool = False,
) -> dict:
    """Execute an action type with the given parameters.

    Returns a result dict with keys: success, message, changes.
    """
    result = await db.execute(select(ActionType).where(ActionType.id == action_type_id))
    action = result.scalar_one_or_none()
    if not action:
        raise ActionError(f"Action type not found: {action_type_id}")

    param_schema = action.parameters.get("parameters", []) if isinstance(action.parameters, dict) else []
    validated = _validate_params(param_schema, params)

    logic_type = action.logic_type
    config = action.logic_config or {}

    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "message": f"Validation passed for action '{action.display_name}'",
            "validated_params": validated,
        }

    if logic_type == "edit_object":
        return await _exec_edit(db, config, validated, action.display_name)
    elif logic_type == "create_object":
        return await _exec_create(db, config, validated, action.display_name)
    elif logic_type == "delete_object":
        return await _exec_delete(db, config, validated, action.display_name)
    else:
        raise ActionError(f"Unsupported logic type: {logic_type}")


async def _exec_edit(db: AsyncSession, config: dict, params: dict, action_name: str) -> dict:
    target_id = _render_template(config.get("target", ""), params)
    updates_template: dict = config.get("updates", {})

    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == target_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise ActionError(f"Object not found: {target_id}")

    old_props = dict(obj.properties)
    updates = {k: _render_template(str(v), params) for k, v in updates_template.items()}
    obj.properties = {**obj.properties, **updates}
    await db.flush()
    await db.refresh(obj)

    logger.info("Action '%s' edited object %s: %s", action_name, target_id, updates)
    return {
        "success": True,
        "message": f"Object '{obj.display_name}' updated",
        "object_id": str(obj.id),
        "changes": {k: {"old": old_props.get(k), "new": v} for k, v in updates.items()},
    }


async def _exec_create(db: AsyncSession, config: dict, params: dict, action_name: str) -> dict:
    object_type_id = _render_template(config.get("object_type_id", ""), params)
    props_template: dict = config.get("properties", {})
    display_name = _render_template(config.get("display_name", ""), params)

    type_check = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    if not type_check.scalar_one_or_none():
        raise ActionError(f"Object type not found: {object_type_id}")

    props = {k: _render_template(str(v), params) for k, v in props_template.items()}
    obj = ObjectInstance(object_type_id=object_type_id, display_name=display_name or None, properties=props)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)

    logger.info("Action '%s' created object %s", action_name, obj.id)
    return {
        "success": True,
        "message": f"Object '{obj.display_name or obj.id}' created",
        "object_id": str(obj.id),
    }


async def _exec_delete(db: AsyncSession, config: dict, params: dict, action_name: str) -> dict:
    target_id = _render_template(config.get("target", ""), params)

    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == target_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise ActionError(f"Object not found: {target_id}")

    display = obj.display_name or obj.id
    await db.delete(obj)
    await db.flush()

    logger.info("Action '%s' deleted object %s", action_name, target_id)
    return {
        "success": True,
        "message": f"Object '{display}' deleted",
        "object_id": target_id,
    }
