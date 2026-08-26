import uuid
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import engine, get_db

# Crear tablas automáticas en PostgreSQL
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SSPILLOWY Core API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    repo_url: str
    git_token: Optional[str] = None

@app.get("/")
def read_root():
    return {"status": "ok", "message": "SSPILLOWY Core API funcionando"}

@app.get("/api/scans")
def list_scans(db: Session = Depends(get_db)):
    scans = db.query(models.Scan).all()
    return [
        {
            "id": str(s.id),
            "repository_id": str(s.repository_id),
            "status": s.status,
            "created_at": str(s.created_at) if hasattr(s, "created_at") else ""
        }
        for s in scans
    ]

@app.post("/api/scans")
def create_scan(request: ScanRequest, db: Session = Depends(get_db)):
    try:
        # Busca si el repo existe o crea uno nuevo
        repo = db.query(models.Repository).filter(models.Repository.url == request.repo_url).first()
        
        if not repo:
            repo_name = request.repo_url.rstrip("/").split("/")[-1]
            repo = models.Repository(
                name=repo_name,
                url=request.repo_url
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

        # Guarda el escaneo vinculándolo al id del repositorio
        new_scan = models.Scan(
            repository_id=repo.id,
            status="completed"
        )
        db.add(new_scan)
        db.commit()
        db.refresh(new_scan)

        return {
            "message": "Escaneo registrado exitosamente",
            "id": str(new_scan.id),
            "repository_id": str(repo.id)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))