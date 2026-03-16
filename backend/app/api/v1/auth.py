from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import UserCreate, UserLogin, UserResponse, UserUpdateRole, UserUpdate, Token
from app.services.auth_service import (
    register_user, authenticate_user, create_access_token, get_current_user,
    require_admin, ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER,
)
from app.services.audit_service import create_audit_log
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    user = await register_user(db, data)
    return user


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.username, data.password)
    token = create_access_token(str(user.id))
    await create_audit_log(db, user, "login", "auth")
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    data: UserUpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if data.role not in (ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER):
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {ROLE_ADMIN}, {ROLE_EDITOR}, {ROLE_VIEWER}")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change own role")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = data.role
    await db.flush()
    await db.refresh(user)

    await create_audit_log(
        db, current_user, "update_role", "user", user_id,
        {"username": user.username, "old_role": old_role, "new_role": data.role},
    )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)

    await create_audit_log(
        db, current_user, "update_user", "user", user_id,
        {"username": user.username, "changes": data.model_dump(exclude_unset=True)},
    )
    return user
