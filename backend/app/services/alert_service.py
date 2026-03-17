"""Alert evaluation engine — checks objects against alert rules."""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import AlertRule, Alert
from app.models.instance import ObjectInstance

logger = logging.getLogger("uvicorn.error")

_OPS = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    ">": lambda a, b: float(a) > float(b),
    ">=": lambda a, b: float(a) >= float(b),
    "<": lambda a, b: float(a) < float(b),
    "<=": lambda a, b: float(a) <= float(b),
    "contains": lambda a, b: str(b) in str(a),
}


def _evaluate_condition(props: dict, condition: dict) -> bool:
    field = condition.get("field")
    operator = condition.get("operator", "==")
    value = condition.get("value")
    if field is None or value is None:
        return False
    actual = props.get(field)
    if actual is None:
        return False
    try:
        return _OPS.get(operator, lambda a, b: False)(actual, value)
    except (ValueError, TypeError):
        return False


async def check_alerts_for_objects(
    db: AsyncSession,
    object_type_id: str,
    object_ids: list[str],
) -> list[Alert]:
    """Check newly created/updated objects against active alert rules.

    Returns list of newly created Alert records.
    """
    rules_result = await db.execute(
        select(AlertRule).where(
            AlertRule.object_type_id == object_type_id,
            AlertRule.is_active == True,
        )
    )
    rules = rules_result.scalars().all()
    if not rules:
        return []

    objs_result = await db.execute(
        select(ObjectInstance).where(ObjectInstance.id.in_(object_ids))
    )
    objects = objs_result.scalars().all()
    rule_ids = [r.id for r in rules]
    object_id_set = {obj.id for obj in objects}
    if not object_id_set:
        return []

    existing_result = await db.execute(
        select(Alert.rule_id, Alert.object_id).where(
            Alert.rule_id.in_(rule_ids),
            Alert.object_id.in_(object_id_set),
        )
    )
    existing_pairs = {(rule_id, obj_id) for rule_id, obj_id in existing_result.all()}

    new_alerts: list[Alert] = []
    for obj in objects:
        for rule in rules:
            if _evaluate_condition(obj.properties, rule.condition):
                pair = (rule.id, obj.id)
                if pair in existing_pairs:
                    continue
                alert = Alert(
                    rule_id=rule.id,
                    object_id=obj.id,
                    severity=rule.severity,
                    message=f"[{rule.name}] {obj.display_name or obj.id}: "
                            f"{rule.condition.get('field')} {rule.condition.get('operator')} {rule.condition.get('value')}",
                )
                db.add(alert)
                new_alerts.append(alert)
                existing_pairs.add(pair)

    if new_alerts:
        await db.flush()
        logger.info("Created %d alerts for %d objects", len(new_alerts), len(object_ids))

    return new_alerts
