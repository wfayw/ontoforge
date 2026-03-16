"""Resolve widget data bindings by querying the ontology/aggregate APIs."""

import re
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instance import ObjectInstance
from app.models.ontology import ObjectType, PropertyDefinition
from app.models.alert import Alert, AlertRule

_VAR_RE = re.compile(r"\{\{(\w+)\}\}")


def substitute_variables(data_binding: dict, variables: dict) -> dict:
    """Replace {{var_name}} references in filter values with runtime variable values."""
    if not variables or not data_binding:
        return data_binding

    result = dict(data_binding)
    filters = result.get("filters")
    if isinstance(filters, dict):
        new_filters = {}
        for k, v in filters.items():
            if isinstance(v, str):
                m = _VAR_RE.fullmatch(v.strip())
                if m and m.group(1) in variables:
                    runtime_val = variables[m.group(1)]
                    if runtime_val is not None and runtime_val != "":
                        new_filters[k] = runtime_val
                    continue
            new_filters[k] = v
        result["filters"] = new_filters
    return result


async def resolve_widget_data(
    db: AsyncSession, widget_type: str, data_binding: dict, variables: dict | None = None,
) -> dict:
    """Resolve a single widget's data binding into actual data."""
    if not data_binding:
        return {}

    binding = substitute_variables(data_binding, variables or {})
    object_type_id = binding.get("object_type_id")

    if widget_type == "stat_card":
        return await _resolve_stat_card(db, binding, object_type_id)
    elif widget_type == "table":
        return await _resolve_table(db, binding, object_type_id)
    elif widget_type == "chart":
        return await _resolve_chart(db, binding, object_type_id)
    elif widget_type == "filter":
        return await _resolve_filter(db, binding, object_type_id)
    elif widget_type == "object_list":
        return await _resolve_object_list(db, binding, object_type_id)
    elif widget_type == "alert_list":
        return await _resolve_alert_list(db, binding)
    return {}


async def _resolve_stat_card(db: AsyncSession, binding: dict, object_type_id: str | None) -> dict:
    metric = binding.get("metric", "count")
    property_name = binding.get("property_name")
    filters = binding.get("filters", {})

    query = select(sa_func.count()).select_from(ObjectInstance)
    if object_type_id:
        query = query.where(ObjectInstance.object_type_id == object_type_id)
    query = _apply_filters(query, filters)

    if metric == "count":
        result = await db.execute(query)
        return {"value": result.scalar() or 0}

    if not property_name:
        return {"value": 0}

    objs = await _get_objects(db, object_type_id, filters)
    values = [float(o.properties.get(property_name, 0) or 0) for o in objs if o.properties.get(property_name) is not None]
    if not values:
        return {"value": 0}

    if metric == "sum":
        return {"value": sum(values)}
    elif metric == "avg":
        return {"value": round(sum(values) / len(values), 2)}
    elif metric == "min":
        return {"value": min(values)}
    elif metric == "max":
        return {"value": max(values)}
    return {"value": 0}


async def _resolve_table(db: AsyncSession, binding: dict, object_type_id: str | None) -> dict:
    page_size = binding.get("page_size", 20)
    filters = binding.get("filters", {})
    objs = await _get_objects(db, object_type_id, filters, limit=page_size)
    return {
        "items": [
            {"id": o.id, "display_name": o.display_name, "properties": o.properties, "created_at": str(o.created_at)}
            for o in objs
        ]
    }


async def _resolve_chart(db: AsyncSession, binding: dict, object_type_id: str | None) -> dict:
    group_by = binding.get("group_by")
    metric = binding.get("metric", "count")
    property_name = binding.get("property_name")
    filters = binding.get("filters", {})

    if not group_by:
        return {"results": []}

    objs = await _get_objects(db, object_type_id, filters, limit=1000)
    groups: dict[str, list] = {}
    for o in objs:
        key = str(o.properties.get(group_by, "unknown") or "unknown")
        groups.setdefault(key, []).append(o)

    results = []
    for key, items in groups.items():
        if metric == "count":
            results.append({"key": key, "value": len(items)})
        elif metric in ("sum", "avg") and property_name:
            vals = [float(i.properties.get(property_name, 0) or 0) for i in items]
            v = sum(vals) if metric == "sum" else (sum(vals) / len(vals) if vals else 0)
            results.append({"key": key, "value": round(v, 2)})

    results.sort(key=lambda x: x["value"], reverse=True)
    return {"results": results}


async def _get_objects(
    db: AsyncSession, object_type_id: str | None, filters: dict, limit: int = 500
) -> list[ObjectInstance]:
    query = select(ObjectInstance)
    if object_type_id:
        query = query.where(ObjectInstance.object_type_id == object_type_id)
    query = _apply_filters(query, filters)
    query = query.order_by(ObjectInstance.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


def _apply_filters(query, filters: dict):
    for key, value in filters.items():
        query = query.where(ObjectInstance.properties[key].as_string() == str(value))
    return query


async def _resolve_filter(db: AsyncSession, binding: dict, object_type_id: str | None) -> dict:
    """Return distinct values for a given property so the frontend can populate a dropdown."""
    field = binding.get("field")
    if not field or not object_type_id:
        return {"options": []}

    objs = await _get_objects(db, object_type_id, {}, limit=1000)
    values = sorted({str(o.properties.get(field, "") or "") for o in objs if o.properties.get(field)})
    return {"options": values}


async def _resolve_object_list(db: AsyncSession, binding: dict, object_type_id: str | None) -> dict:
    """Return a list of objects with display_name and key properties for card-style rendering."""
    page_size = binding.get("page_size", 20)
    filters = binding.get("filters", {})
    display_properties = binding.get("display_properties", [])
    objs = await _get_objects(db, object_type_id, filters, limit=page_size)

    items = []
    for o in objs:
        item: dict = {"id": o.id, "display_name": o.display_name}
        if display_properties:
            item["properties"] = {k: o.properties.get(k) for k in display_properties if k in o.properties}
        else:
            item["properties"] = o.properties
        items.append(item)
    return {"items": items, "total": len(items)}


async def _resolve_alert_list(db: AsyncSession, binding: dict) -> dict:
    """Return recent alerts with optional severity/read filters."""
    severity = binding.get("severity")
    is_read = binding.get("is_read")
    page_size = binding.get("page_size", 20)

    stmt = select(Alert).order_by(Alert.created_at.desc())
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if is_read is not None:
        stmt = stmt.where(Alert.is_read == is_read)
    stmt = stmt.limit(page_size)
    result = await db.execute(stmt)
    alerts = result.scalars().all()

    unread_result = await db.execute(
        select(sa_func.count(Alert.id)).where(Alert.is_read == False)
    )
    unread = unread_result.scalar() or 0

    return {
        "alerts": [
            {
                "id": a.id,
                "severity": a.severity,
                "message": a.message,
                "is_read": a.is_read,
                "object_id": a.object_id,
                "created_at": str(a.created_at),
            }
            for a in alerts
        ],
        "unread": unread,
    }
