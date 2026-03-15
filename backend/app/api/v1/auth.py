from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token
from app.services.auth_service import (
    register_user, authenticate_user, create_access_token, get_current_user,
)
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
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
