from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.ontology import ObjectType, PropertyDefinition, LinkType, ActionType
from app.schemas.ontology import (
    ObjectTypeCreate, ObjectTypeUpdate, ObjectTypeResponse,
    PropertyDefinitionCreate, PropertyDefinitionResponse,
    LinkTypeCreate, LinkTypeResponse,
    ActionTypeCreate, ActionTypeResponse,
)
from app.services.auth_service import get_current_user
from app.services.action_executor import execute_action, ActionError

router = APIRouter()


# ── Object Types ──────────────────────────────────────────────

@router.get("/object-types", response_model=list[ObjectTypeResponse])
async def list_object_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).order_by(ObjectType.created_at.desc()))
    return result.scalars().all()


@router.post("/object-types", response_model=ObjectTypeResponse, status_code=201)
async def create_object_type(data: ObjectTypeCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    obj_type = ObjectType(
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        icon=data.icon,
        color=data.color,
        primary_key_property=data.primary_key_property,
    )
    db.add(obj_type)
    await db.flush()

    for prop in data.properties:
        db.add(PropertyDefinition(object_type_id=obj_type.id, **prop.model_dump()))
    await db.flush()
    await db.refresh(obj_type)
    return obj_type


@router.get("/object-types/{type_id}", response_model=ObjectTypeResponse)
async def get_object_type(type_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if not obj_type:
        raise HTTPException(status_code=404, detail="Object type not found")
    return obj_type


@router.patch("/object-types/{type_id}", response_model=ObjectTypeResponse)
async def update_object_type(type_id: str, data: ObjectTypeUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if not obj_type:
        raise HTTPException(status_code=404, detail="Object type not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj_type, field, value)
    await db.flush()
    await db.refresh(obj_type)
    return obj_type


@router.delete("/object-types/{type_id}", status_code=204)
async def delete_object_type(type_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if not obj_type:
        raise HTTPException(status_code=404, detail="Object type not found")
    await db.delete(obj_type)


# ── Properties ────────────────────────────────────────────────

@router.post("/object-types/{type_id}/properties", response_model=PropertyDefinitionResponse, status_code=201)
async def add_property(type_id: str, data: PropertyDefinitionCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Object type not found")
    prop = PropertyDefinition(object_type_id=type_id, **data.model_dump())
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    return prop


@router.delete("/properties/{prop_id}", status_code=204)
async def delete_property(prop_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await db.execute(delete(PropertyDefinition).where(PropertyDefinition.id == prop_id))


# ── Link Types ────────────────────────────────────────────────

@router.get("/link-types", response_model=list[LinkTypeResponse])
async def list_link_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(LinkType).order_by(LinkType.created_at.desc()))
    return result.scalars().all()


@router.post("/link-types", response_model=LinkTypeResponse, status_code=201)
async def create_link_type(data: LinkTypeCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    link_type = LinkType(**data.model_dump())
    db.add(link_type)
    await db.flush()
    await db.refresh(link_type)
    return link_type


@router.delete("/link-types/{link_type_id}", status_code=204)
async def delete_link_type(link_type_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(LinkType).where(LinkType.id == link_type_id))
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Link type not found")
    await db.delete(lt)


# ── Action Types ──────────────────────────────────────────────

@router.get("/action-types", response_model=list[ActionTypeResponse])
async def list_action_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ActionType).order_by(ActionType.created_at.desc()))
    return result.scalars().all()


@router.post("/action-types", response_model=ActionTypeResponse, status_code=201)
async def create_action_type(data: ActionTypeCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    action = ActionType(**data.model_dump())
    db.add(action)
    await db.flush()
    await db.refresh(action)
    return action


@router.delete("/action-types/{action_id}", status_code=204)
async def delete_action_type(action_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ActionType).where(ActionType.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action type not found")
    await db.delete(action)


class ActionExecuteBody(BaseModel):
    params: dict = {}


@router.post("/action-types/{action_id}/execute")
async def execute_action_by_id(
    action_id: str,
    data: ActionExecuteBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        result = await execute_action(db, action_id, data.params)
        return result
    except ActionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/action-types/{action_id}/validate")
async def validate_action_by_id(
    action_id: str,
    data: ActionExecuteBody,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        result = await execute_action(db, action_id, data.params, dry_run=True)
        return result
    except ActionError as e:
        raise HTTPException(status_code=400, detail=str(e))
