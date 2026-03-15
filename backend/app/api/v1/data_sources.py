from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.data_integration import DataSource
from app.schemas.data_integration import (
    DataSourceCreate, DataSourceUpdate, DataSourceResponse, DataPreview,
)
from app.services.auth_service import get_current_user
from app.services.data_integration_service import test_connection, preview_data, upload_csv

router = APIRouter()


@router.get("/", response_model=list[DataSourceResponse])
async def list_data_sources(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).order_by(DataSource.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=DataSourceResponse, status_code=201)
async def create_data_source(data: DataSourceCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    ds = DataSource(**data.model_dump())
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(ds_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    return ds


@router.patch("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(ds_id: str, data: DataSourceUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ds, field, value)
    await db.flush()
    await db.refresh(ds)
    return ds


@router.delete("/{ds_id}", status_code=204)
async def delete_data_source(ds_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.delete(ds)


@router.post("/{ds_id}/test")
async def test_data_source(ds_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    success, message = await test_connection(ds)
    if success:
        ds.status = "active"
    else:
        ds.status = "error"
    await db.flush()
    return {"success": success, "message": message}


@router.get("/{ds_id}/preview", response_model=DataPreview)
async def preview_data_source(ds_id: str, limit: int = 100, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Data source not found")
    return await preview_data(ds, limit)


@router.post("/upload-csv", response_model=DataSourceResponse)
async def upload_csv_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await upload_csv(db, file)
