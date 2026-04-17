from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    hashed_password: str
    is_admin: bool = False
    quota_gb: float = 5.0  # Default 5GB
    used_bytes: int = 0
    download_limit_kbps: int = 500  # Default 500 KB/s
    upload_limit_kbps: int = 500    # Default 500 KB/s
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
