from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import models
from database import engine, get_db

# Crea las tablas físicas en PostgreSQL si no existen
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SSPILLOWY Core API", version="1.0.0")

@app.get("/")
def read_root():
    return {"status": "online", "database": "PostgreSQL 16 Connected"}

@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    # Consulta simple para confirmar que la BD responde
    scan_count = db.query(models.Scan).count()
    return {"status": "ok", "total_scans_in_db": scan_count}
