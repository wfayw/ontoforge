from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_integration import Pipeline, PipelineRun, DataSource
from app.models.instance import ObjectInstance
from app.services.data_integration_service import fetch_source_data


def apply_transforms(df: pd.DataFrame, steps: list) -> pd.DataFrame:
    """Apply transformation steps to a DataFrame."""
    for step in steps:
        op = step.get("operation")
        if op == "rename":
            df = df.rename(columns=step.get("mapping", {}))
        elif op == "filter":
            col = step.get("column")
            val = step.get("value")
            operator = step.get("operator", "eq")
            if col in df.columns:
                if operator == "eq":
                    df = df[df[col] == val]
                elif operator == "ne":
                    df = df[df[col] != val]
                elif operator == "gt":
                    df = df[df[col] > val]
                elif operator == "lt":
                    df = df[df[col] < val]
                elif operator == "contains":
                    df = df[df[col].astype(str).str.contains(str(val), na=False)]
        elif op == "drop_columns":
            cols = step.get("columns", [])
            df = df.drop(columns=[c for c in cols if c in df.columns])
        elif op == "fill_na":
            fill_value = step.get("value", "")
            df = df.fillna(fill_value)
        elif op == "cast":
            col = step.get("column")
            dtype = step.get("dtype")
            if col in df.columns and dtype:
                try:
                    df[col] = df[col].astype(dtype)
                except (ValueError, TypeError):
                    pass
    return df


_ID_KEYS = (
    "name", "title", "display_name",
    "inspection_id", "po_number", "part_number",
    "supplier_code", "plant_code", "code", "id",
)


def _resolve_display_name(props: dict, fallback_idx: int) -> str:
    display = next((props[k] for k in _ID_KEYS if props.get(k)), None)
    if not display:
        display = next((v for v in props.values() if isinstance(v, str) and v), str(fallback_idx + 1))
    return str(display)


async def execute_pipeline(db: AsyncSession, pipeline: Pipeline) -> PipelineRun:
    """Execute a pipeline: fetch data, transform, and load into ontology objects."""
    run = PipelineRun(pipeline_id=pipeline.id, status="running", started_at=datetime.utcnow())
    db.add(run)
    await db.flush()

    try:
        source_result = await db.execute(select(DataSource).where(DataSource.id == pipeline.source_id))
        source = source_result.scalar_one_or_none()
        if not source:
            raise ValueError("Data source not found")

        df = await fetch_source_data(source)
        if df.empty:
            raise ValueError("No data returned from source")

        if pipeline.transform_steps:
            df = apply_transforms(df, pipeline.transform_steps)

        mappings = pipeline.field_mappings or {}
        is_incremental = pipeline.sync_mode == "incremental"
        pk_prop = pipeline.primary_key_property

        existing_by_pk: dict[str, ObjectInstance] = {}
        if is_incremental and pk_prop:
            result = await db.execute(
                select(ObjectInstance).where(
                    ObjectInstance.object_type_id == pipeline.target_object_type_id
                )
            )
            for obj in result.scalars().all():
                pk_val = obj.properties.get(pk_prop)
                if pk_val is not None:
                    existing_by_pk[str(pk_val)] = obj

        rows_created = 0
        rows_updated = 0
        rows_skipped = 0
        rows_err = 0
        new_object_ids: list[str] = []

        for row_idx, (_, row) in enumerate(df.iterrows()):
            try:
                props = {}
                for source_col, target_prop in mappings.items():
                    if source_col in row.index:
                        val = row[source_col]
                        props[target_prop] = None if pd.isna(val) else val
                        if isinstance(val, (pd.Timestamp, datetime)):
                            props[target_prop] = val.isoformat()

                display = _resolve_display_name(props, rows_created + rows_updated)

                if is_incremental and pk_prop:
                    pk_val = str(props.get(pk_prop, ""))
                    if pk_val in existing_by_pk:
                        existing_obj = existing_by_pk[pk_val]
                        if existing_obj.properties != props:
                            existing_obj.properties = {**existing_obj.properties, **props}
                            existing_obj.display_name = display
                            existing_obj.source_run_id = run.id
                            new_object_ids.append(existing_obj.id)
                            rows_updated += 1
                        else:
                            rows_skipped += 1
                        continue

                obj = ObjectInstance(
                    object_type_id=pipeline.target_object_type_id,
                    display_name=display,
                    properties=props,
                    source_pipeline_id=pipeline.id,
                    source_run_id=run.id,
                    source_row_index=row_idx,
                )
                db.add(obj)
                await db.flush()
                new_object_ids.append(obj.id)
                rows_created += 1
            except Exception:
                rows_err += 1

        await db.flush()

        run.status = "success"
        run.rows_processed = rows_created + rows_updated + rows_skipped
        run.rows_created = rows_created
        run.rows_updated = rows_updated
        run.rows_skipped = rows_skipped
        run.rows_failed = rows_err
        run.finished_at = datetime.utcnow()
        pipeline.status = "active"

        if new_object_ids:
            try:
                from app.services.alert_service import check_alerts_for_objects
                await check_alerts_for_objects(db, pipeline.target_object_type_id, new_object_ids)
            except Exception:
                pass

    except Exception as e:
        run.status = "failed"
        run.error_log = str(e)
        run.finished_at = datetime.utcnow()
        pipeline.status = "error"

    await db.flush()
    await db.refresh(run)
    return run
