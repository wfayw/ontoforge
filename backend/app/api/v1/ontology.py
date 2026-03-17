from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.ontology import ObjectType, PropertyDefinition, LinkType, ActionType, FunctionDef
from app.schemas.ontology import (
    ObjectTypeCreate, ObjectTypeUpdate, ObjectTypeResponse,
    PropertyDefinitionCreate, PropertyDefinitionResponse,
    LinkTypeCreate, LinkTypeResponse, LinkTypeUpdate,
    ActionTypeCreate, ActionTypeResponse, ActionTypeUpdate,
    PropertyDefinitionUpdate,
    FunctionDefCreate, FunctionDefUpdate, FunctionDefResponse, FunctionExecuteRequest,
    OntologyGenerateRequest, OntologyGeneratePreview, OntologyApplyRequest,
)
from app.services.auth_service import get_current_user, require_editor
from app.services.audit_service import create_audit_log
from app.services.action_executor import execute_action, ActionError
from app.services.ontology_generator import generate_ontology, apply_ontology_plan
from app.services.function_executor import execute_function, FunctionError

router = APIRouter()


# ── Object Types ──────────────────────────────────────────────

@router.get("/object-types", response_model=list[ObjectTypeResponse])
async def list_object_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).order_by(ObjectType.created_at.desc()))
    return result.scalars().all()


@router.post("/object-types", response_model=ObjectTypeResponse, status_code=201)
async def create_object_type(data: ObjectTypeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
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
    await create_audit_log(db, user, "create", "object_type", obj_type.id, {"name": data.name})
    return obj_type


@router.get("/object-types/{type_id}", response_model=ObjectTypeResponse)
async def get_object_type(type_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if not obj_type:
        raise HTTPException(status_code=404, detail="Object type not found")
    return obj_type


@router.patch("/object-types/{type_id}", response_model=ObjectTypeResponse)
async def update_object_type(type_id: str, data: ObjectTypeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
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
async def delete_object_type(type_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    obj_type = result.scalar_one_or_none()
    if not obj_type:
        raise HTTPException(status_code=404, detail="Object type not found")
    await create_audit_log(db, user, "delete", "object_type", type_id)
    await db.delete(obj_type)


# ── Properties ────────────────────────────────────────────────

@router.post("/object-types/{type_id}/properties", response_model=PropertyDefinitionResponse, status_code=201)
async def add_property(type_id: str, data: PropertyDefinitionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(ObjectType).where(ObjectType.id == type_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Object type not found")
    prop = PropertyDefinition(object_type_id=type_id, **data.model_dump())
    db.add(prop)
    await db.flush()
    await db.refresh(prop)
    return prop


@router.delete("/properties/{prop_id}", status_code=204)
async def delete_property(prop_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    await db.execute(delete(PropertyDefinition).where(PropertyDefinition.id == prop_id))


@router.patch("/properties/{prop_id}", response_model=PropertyDefinitionResponse)
async def update_property(prop_id: str, data: PropertyDefinitionUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(PropertyDefinition).where(PropertyDefinition.id == prop_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    await db.flush()
    await db.refresh(prop)
    return prop


# ── Link Types ────────────────────────────────────────────────

@router.get("/link-types", response_model=list[LinkTypeResponse])
async def list_link_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(LinkType).order_by(LinkType.created_at.desc()))
    return result.scalars().all()


@router.post("/link-types", response_model=LinkTypeResponse, status_code=201)
async def create_link_type(data: LinkTypeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    link_type = LinkType(**data.model_dump())
    db.add(link_type)
    await db.flush()
    await db.refresh(link_type)
    await create_audit_log(db, user, "create", "link_type", link_type.id, {"name": data.name})
    return link_type


@router.delete("/link-types/{link_type_id}", status_code=204)
async def delete_link_type(link_type_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(LinkType).where(LinkType.id == link_type_id))
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Link type not found")
    await create_audit_log(db, user, "delete", "link_type", link_type_id)
    await db.delete(lt)


@router.patch("/link-types/{link_type_id}", response_model=LinkTypeResponse)
async def update_link_type(link_type_id: str, data: LinkTypeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(LinkType).where(LinkType.id == link_type_id))
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Link type not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lt, field, value)
    await db.flush()
    await db.refresh(lt)
    return lt


# ── Action Types ──────────────────────────────────────────────

@router.get("/action-types", response_model=list[ActionTypeResponse])
async def list_action_types(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ActionType).order_by(ActionType.created_at.desc()))
    return result.scalars().all()


@router.post("/action-types", response_model=ActionTypeResponse, status_code=201)
async def create_action_type(data: ActionTypeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    action = ActionType(**data.model_dump())
    db.add(action)
    await db.flush()
    await db.refresh(action)
    await create_audit_log(db, user, "create", "action_type", action.id, {"name": data.name})
    return action


@router.delete("/action-types/{action_id}", status_code=204)
async def delete_action_type(action_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(ActionType).where(ActionType.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action type not found")
    await create_audit_log(db, user, "delete", "action_type", action_id)
    await db.delete(action)


@router.patch("/action-types/{action_id}", response_model=ActionTypeResponse)
async def update_action_type(action_id: str, data: ActionTypeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(ActionType).where(ActionType.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action type not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(action, field, value)
    await db.flush()
    await db.refresh(action)
    return action


class ActionExecuteBody(BaseModel):
    params: dict = Field(default_factory=dict)


@router.post("/action-types/{action_id}/execute")
async def execute_action_by_id(
    action_id: str,
    data: ActionExecuteBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    try:
        result = await execute_action(db, action_id, data.params)
        await create_audit_log(db, user, "execute", "action_type", action_id, {"params": data.params})
        return result
    except ActionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/action-types/{action_id}/validate")
async def validate_action_by_id(
    action_id: str,
    data: ActionExecuteBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    try:
        result = await execute_action(db, action_id, data.params, dry_run=True)
        return result
    except ActionError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Ontology Functions ────────────────────────────────────────

@router.get("/functions", response_model=list[FunctionDefResponse])
async def list_functions(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(FunctionDef).order_by(FunctionDef.created_at.desc()))
    return result.scalars().all()


@router.post("/functions", response_model=FunctionDefResponse, status_code=201)
async def create_function(data: FunctionDefCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    func = FunctionDef(**data.model_dump())
    db.add(func)
    await db.flush()
    await db.refresh(func)
    await create_audit_log(db, user, "create", "ontology_function", func.id, {"name": data.name})
    return func


@router.get("/functions/{func_id}", response_model=FunctionDefResponse)
async def get_function(func_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(FunctionDef).where(FunctionDef.id == func_id))
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    return func


@router.patch("/functions/{func_id}", response_model=FunctionDefResponse)
async def update_function(func_id: str, data: FunctionDefUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(FunctionDef).where(FunctionDef.id == func_id))
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(func, field, value)
    await db.flush()
    await db.refresh(func)
    return func


@router.delete("/functions/{func_id}", status_code=204)
async def delete_function(func_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(FunctionDef).where(FunctionDef.id == func_id))
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    await create_audit_log(db, user, "delete", "ontology_function", func_id)
    await db.delete(func)


@router.post("/functions/{func_id}/execute")
async def execute_function_by_id(
    func_id: str,
    data: FunctionExecuteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(FunctionDef).where(FunctionDef.id == func_id))
    func = result.scalar_one_or_none()
    if not func:
        raise HTTPException(status_code=404, detail="Function not found")
    if not func.implementation:
        raise HTTPException(status_code=400, detail="Function has no implementation")
    try:
        output = execute_function(func.implementation, data.inputs)
        return {"success": True, "result": output}
    except FunctionError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── AI Ontology Generator ────────────────────────────────────

@router.post("/generate", response_model=OntologyGeneratePreview)
async def ai_generate_ontology(
    data: OntologyGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    """Call LLM to generate an ontology plan from natural language. Returns preview (not persisted)."""
    try:
        plan = await generate_ontology(db, data.description, data.provider_id)
        return {"plan": plan}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {e}")


@router.post("/apply-plan")
async def ai_apply_ontology_plan(
    data: OntologyApplyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    """Persist a previously generated ontology plan."""
    try:
        result = await apply_ontology_plan(db, data.plan)
        await create_audit_log(db, user, "ai_generate", "ontology", None, {
            "object_types": len(result["object_types"]),
            "link_types": len(result["link_types"]),
            "action_types": len(result["action_types"]),
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {e}")
