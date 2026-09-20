from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

import models
from database import engine, Base, get_db

app = FastAPI(title="SSPILLOWY Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    session_id: str
    user_id: str
    email: str

class ScanResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: str
    severity: str
    created_at: datetime

    class Config:
        from_attributes = True

@app.post("/api/v1/auth/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    return LoginResponse(
        access_token=f"jwt_{uuid.uuid4().hex}",
        session_id=session_id,
        user_id="usr_12345",
        email=credentials.email
    )

# Ruta normalizada exigida por el Criterio de Aceptación
@app.get("/api/v1/scans", response_model=List[ScanResponse])
async def list_scans(
    x_session_id: Optional[str] = Header(None, alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Scan))
    return result.scalars().all()

@app.get("/api/v1/findings")
async def list_findings(
    x_session_id: Optional[str] = Header(None, alias="X-Session-Id"),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Finding))
    return result.scalars().all()

@app.get("/")
async def root():
    return {"status": "ok"}
