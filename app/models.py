from pydantic import BaseModel
from typing import Optional


class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class NoteIn(BaseModel):
    title: str
    content: str
    tags: Optional[str] = ""
    is_pinned: Optional[bool] = False
    created_at: Optional[str] = None
    auto_delete_at: Optional[str] = None
    remind_at: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    is_pinned: Optional[bool] = None
    created_at: Optional[str] = None
    auto_delete_at: Optional[str] = None
    remind_at: Optional[str] = None
