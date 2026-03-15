import io
import csv as csv_module
from typing import Tuple

import pandas as pd
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_integration import DataSource
from app.schemas.data_integration import DataPreview

_CSV_STORAGE: dict[str, pd.DataFrame] = {}


async def test_connection(ds: DataSource) -> Tuple[bool, str]:
    """Test connectivity to the data source."""
    try:
        if ds.source_type == "csv":
            if str(ds.id) in _CSV_STORAGE:
                return True, "CSV data loaded in memory"
            return False, "CSV data not loaded. Please upload a file."

        elif ds.source_type == "postgres":
            import asyncpg
            cfg = ds.connection_config
            conn = await asyncpg.connect(
                host=cfg.get("host", "localhost"),
                port=cfg.get("port", 5432),
                user=cfg.get("user", ""),
                password=cfg.get("password", ""),
                database=cfg.get("database", ""),
            )
            await conn.execute("SELECT 1")
            await conn.close()
            return True, "Connection successful"

        elif ds.source_type == "rest_api":
            import httpx
            cfg = ds.connection_config
            async with httpx.AsyncClient() as client:
                resp = await client.get(cfg.get("url", ""), timeout=10)
                resp.raise_for_status()
            return True, f"API responded with status {resp.status_code}"

        else:
            return False, f"Unsupported source type: {ds.source_type}"
    except Exception as e:
        return False, str(e)


async def preview_data(ds: DataSource, limit: int = 100) -> DataPreview:
    """Preview rows from the data source."""
    if ds.source_type == "csv":
        df = _CSV_STORAGE.get(str(ds.id))
        if df is None:
            return DataPreview(columns=[], rows=[], total_count=0)
        preview_df = df.head(limit)
        return DataPreview(
            columns=list(preview_df.columns),
            rows=preview_df.fillna("").to_dict(orient="records"),
            total_count=len(df),
        )

    elif ds.source_type == "postgres":
        import asyncpg
        cfg = ds.connection_config
        conn = await asyncpg.connect(
            host=cfg.get("host", "localhost"),
            port=cfg.get("port", 5432),
            user=cfg.get("user", ""),
            password=cfg.get("password", ""),
            database=cfg.get("database", ""),
        )
        table = cfg.get("table", "")
        rows = await conn.fetch(f'SELECT * FROM "{table}" LIMIT {limit}')
        await conn.close()
        if not rows:
            return DataPreview(columns=[], rows=[], total_count=0)
        columns = list(rows[0].keys())
        return DataPreview(
            columns=columns,
            rows=[dict(r) for r in rows],
            total_count=len(rows),
        )

    elif ds.source_type == "rest_api":
        import httpx
        cfg = ds.connection_config
        async with httpx.AsyncClient() as client:
            resp = await client.get(cfg.get("url", ""), timeout=10)
            data = resp.json()
        if isinstance(data, list):
            items = data[:limit]
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    items = v[:limit]
                    break
            else:
                items = [data]
        else:
            items = []
        columns = list(items[0].keys()) if items else []
        return DataPreview(columns=columns, rows=items, total_count=len(items))

    return DataPreview(columns=[], rows=[], total_count=0)


async def fetch_source_data(ds: DataSource) -> pd.DataFrame:
    """Fetch all data from the source as a DataFrame."""
    if ds.source_type == "csv":
        df = _CSV_STORAGE.get(str(ds.id))
        return df if df is not None else pd.DataFrame()

    elif ds.source_type == "postgres":
        import asyncpg
        cfg = ds.connection_config
        conn = await asyncpg.connect(
            host=cfg.get("host", "localhost"),
            port=cfg.get("port", 5432),
            user=cfg.get("user", ""),
            password=cfg.get("password", ""),
            database=cfg.get("database", ""),
        )
        table = cfg.get("table", "")
        rows = await conn.fetch(f'SELECT * FROM "{table}"')
        await conn.close()
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([dict(r) for r in rows])

    elif ds.source_type == "rest_api":
        import httpx
        cfg = ds.connection_config
        async with httpx.AsyncClient() as client:
            resp = await client.get(cfg.get("url", ""), timeout=30)
            data = resp.json()
        if isinstance(data, list):
            return pd.DataFrame(data)
        elif isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    return pd.DataFrame(v)
        return pd.DataFrame()

    return pd.DataFrame()


async def upload_csv(db: AsyncSession, file: UploadFile) -> DataSource:
    """Upload a CSV file and create a data source."""
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    name = file.filename or "uploaded_csv"
    if name.endswith(".csv"):
        name = name[:-4]

    ds = DataSource(
        name=name,
        description=f"Uploaded CSV: {file.filename}",
        source_type="csv",
        connection_config={"filename": file.filename, "columns": list(df.columns), "row_count": len(df)},
        status="active",
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)

    _CSV_STORAGE[str(ds.id)] = df
    return ds
