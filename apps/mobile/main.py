from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

import models
from database import engine, Base, get_db

app = FastAPI(
    title="SSPILLOWY Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# --- ESQUEMAS PYDANTIC ---

# Auth
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str

# Projects
class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Incidents / Scans / Triage
class ExceptionRequest(BaseModel):
    duration_hours: int = Field(..., description="Horas de excepcion: 24, 72, o 168")
    justification: str = Field(..., min_length=10, description="Justificacion de al menos 10 caracteres")

class BlockRequest(BaseModel):
    reason: str = Field(..., min_length=3, description="Razon de bloqueo de al menos 3 caracteres")

class IncidentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: str
    severity: str
    created_at: datetime
    pillow_summary: Optional[str] = "Resumen de riesgo generado por Pillow para asistencia de triage."

    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    id: str
    email: str
    alias: Optional[str] = "Guardia On-Call"
    on_duty: bool = True

class UserAliasUpdate(BaseModel):
    alias: str

# --- ENDPOINTS REST (/api/v1) ---

# Auth
@app.post("/api/v1/auth/login", response_model=LoginResponse, tags=["Auth"])
async def login(credentials: LoginRequest):
    if not credentials.email or not credentials.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credenciales invalidas"
        )
    return LoginResponse(
        access_token="mock_jwt_token_sspillowy_pulse",
        token_type="bearer",
        user_id="usr_12345",
        email=credentials.email
    )

# Users
@app.get("/api/v1/users/me", response_model=UserProfileResponse, tags=["Users"])
async def get_current_user():
    return UserProfileResponse(id="usr_12345", email="guardia@sspillowy.com", alias="Guardia Principal", on_duty=True)

@app.patch("/api/v1/users/me", response_model=UserProfileResponse, tags=["Users"])
async def update_user_alias(update: UserAliasUpdate):
    return UserProfileResponse(id="usr_12345", email="guardia@sspillowy.com", alias=update.alias, on_duty=True)

# Projects
@app.post("/api/v1/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, tags=["Projects"])
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    db_project = models.Project(name=project.name, description=project.description)
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    return db_project

@app.get("/api/v1/projects", response_model=List[ProjectResponse], tags=["Projects"])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Project))
    return result.scalars().all()

# Incidents / Triage
@app.get("/api/v1/incidents/pending", response_model=List[IncidentResponse], tags=["Incidents"])
async def get_pending_incidents(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(models.Scan)
    if status:
        query = query.where(models.Scan.status == status)
    if severity:
        query = query.where(models.Scan.severity == severity)
    
    result = await db.execute(query)
    scans = result.scalars().all()
    return scans

@app.get("/api/v1/incidents/{incident_id}", response_model=IncidentResponse, tags=["Incidents"])
async def get_incident_detail(incident_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Scan).where(models.Scan.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
    return incident

@app.post("/api/v1/incidents/{incident_id}/exception", tags=["Incidents"])
async def approve_exception(
    incident_id: uuid.UUID,
    payload: ExceptionRequest,
    db: AsyncSession = Depends(get_db)
):
    if payload.duration_hours not in [24, 72, 168]:
        raise HTTPException(status_code=400, detail="La duracion debe ser 24, 72 o 168 horas.")
    
    result = await db.execute(select(models.Scan).where(models.Scan.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
        
    incident.status = "APPROVED_EXCEPTION"
    await db.commit()
    return {"message": "Excepcion temporal aprobada exitosamente", "incident_id": incident_id, "duration_hours": payload.duration_hours}

@app.post("/api/v1/incidents/{incident_id}/block", tags=["Incidents"])
async def confirm_block(
    incident_id: uuid.UUID,
    payload: BlockRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Scan).where(models.Scan.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incidente no encontrado")
        
    incident.status = "BLOCKED"
    await db.commit()
    return {"message": "Bloqueo confirmado exitosamente", "incident_id": incident_id, "reason": payload.reason}

@app.get("/")
async def root():
    return {"status": "ok", "message": "SSPILLOWY API v1 corriendo"}
