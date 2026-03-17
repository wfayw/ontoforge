"""Aggregate / analytics queries on object instances."""

import logging
from typing import Any, Optional

from sqlalchemy import select, func, cast, Float, String, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ontology import ObjectType
from app.models.instance import ObjectInstance

logger = logging.getLogger("uvicorn.error")

_SUPPORTED_FUNCS = {"count", "sum", "avg", "min", "max", "count_distinct"}

_is_pg = "postgresql" in get_settings().DATABASE_URL


def _json_extract(prop_name: str):
    """Cross-DB JSON text extraction (PostgreSQL ->> / SQLite json_extract)."""
    if _is_pg:
        return ObjectInstance.properties[prop_name].as_string()
    return func.json_extract(ObjectInstance.properties, f"$.{prop_name}")


def _json_numeric(prop_name: str):
    return cast(_json_extract(prop_name), Float)


_TIME_GRANULARITY_FMT = {
    "day": "%Y-%m-%d",
    "week": "%Y-W%W",
    "month": "%Y-%m",
}


async def aggregate(
    db: AsyncSession,
    object_type_id: str,
    *,
    metric: str = "count",
    property_name: Optional[str] = None,
    group_by: Optional[str] = None,
    time_granularity: Optional[str] = None,
    date_property: Optional[str] = None,
    filters: Optional[dict[str, Any]] = None,
) -> dict:
    """Run an aggregate query on instances of the given object type.

    metric: count | sum | avg | min | max | count_distinct
    property_name: required for sum/avg/min/max/count_distinct
    group_by: optional property name to group results by
    time_granularity: day | week | month — groups by a date property
    date_property: property name holding date values (defaults to created_at)
    filters: optional {property_name: value} equality filters
    """
    if metric not in _SUPPORTED_FUNCS:
        return {"error": f"Unsupported metric: {metric}. Allowed: {_SUPPORTED_FUNCS}"}

    type_result = await db.execute(select(ObjectType).where(ObjectType.id == object_type_id))
    obj_type = type_result.scalar_one_or_none()
    if not obj_type:
        return {"error": f"Object type not found: {object_type_id}"}

    if metric != "count" and not property_name:
        return {"error": f"property_name is required for metric '{metric}'"}

    agg_col = _build_agg_column(metric, property_name)

    if time_granularity and time_granularity in _TIME_GRANULARITY_FMT:
        fmt = _TIME_GRANULARITY_FMT[time_granularity]
        raw_col = _json_extract(date_property) if date_property else ObjectInstance.created_at
        if _is_pg:
            pg_fmt_map = {"%Y-%m-%d": "YYYY-MM-DD", "%Y-W%W": "YYYY-\"W\"IW", "%Y-%m": "YYYY-MM"}
            time_col = func.to_char(cast(raw_col, String), pg_fmt_map.get(fmt, "YYYY-MM-DD"))
        else:
            time_col = func.strftime(fmt, raw_col)
        stmt = (
            select(time_col.label("period"), agg_col.label("value"))
            .where(ObjectInstance.object_type_id == object_type_id)
        )
        stmt = _apply_filters(stmt, filters)
        stmt = stmt.group_by(time_col).order_by(time_col)
        rows = (await db.execute(stmt)).all()
        return {
            "object_type": obj_type.display_name,
            "metric": metric,
            "property": property_name,
            "time_granularity": time_granularity,
            "date_property": date_property or "created_at",
            "results": [{"period": str(r.period), "value": r.value} for r in rows],
        }
    elif group_by:
        group_col = _json_extract(group_by)
        stmt = (
            select(group_col.label("group_key"), agg_col.label("value"))
            .where(ObjectInstance.object_type_id == object_type_id)
        )
        stmt = _apply_filters(stmt, filters)
        stmt = stmt.group_by(group_col).order_by(agg_col.desc())
        rows = (await db.execute(stmt)).all()
        return {
            "object_type": obj_type.display_name,
            "metric": metric,
            "property": property_name,
            "group_by": group_by,
            "results": [{"key": str(r.group_key), "value": r.value} for r in rows],
        }
    else:
        stmt = (
            select(agg_col.label("value"))
            .where(ObjectInstance.object_type_id == object_type_id)
        )
        stmt = _apply_filters(stmt, filters)
        value = (await db.execute(stmt)).scalar()
        return {
            "object_type": obj_type.display_name,
            "metric": metric,
            "property": property_name,
            "value": value,
        }


def _build_agg_column(metric: str, property_name: Optional[str]):
    if metric == "count":
        return func.count(ObjectInstance.id)
    elif metric == "sum":
        return func.sum(_json_numeric(property_name))
    elif metric == "avg":
        return func.avg(_json_numeric(property_name))
    elif metric == "min":
        return func.min(_json_numeric(property_name))
    elif metric == "max":
        return func.max(_json_numeric(property_name))
    elif metric == "count_distinct":
        return func.count(func.distinct(_json_extract(property_name)))


def _apply_filters(stmt, filters: Optional[dict[str, Any]]):
    if not filters:
        return stmt
    for prop, value in filters.items():
        stmt = stmt.where(_json_extract(prop) == str(value))
    return stmt
