import asyncio
import uuid
from datetime import datetime
from database import AsyncSessionLocal
import models

async def seed():
    async with AsyncSessionLocal() as db:
        p = models.Project(
            id=uuid.uuid4(),
            name="Core Payment Gateway",
            description="Servicio critico de procesador de pagos",
            created_at=datetime.utcnow()
        )
        db.add(p)
        await db.flush()

        s1 = models.Scan(
            id=uuid.uuid4(),
            project_id=p.id,
            title="CVE-2024-3094 - Vulnerabilidad RCE en xz-utils",
            status="OPEN",
            severity="CRITICAL",
            created_at=datetime.utcnow()
        )
        s2 = models.Scan(
            id=uuid.uuid4(),
            project_id=p.id,
            title="SQL Injection en endpoint de login /auth",
            status="BLOCKED",
            severity="HIGH",
            created_at=datetime.utcnow()
        )
        s3 = models.Scan(
            id=uuid.uuid4(),
            project_id=p.id,
            title="Exposicion de API Key en repositorio publico",
            status="OPEN",
            severity="HIGH",
            created_at=datetime.utcnow()
        )
        db.add_all([s1, s2, s3])
        await db.commit()
        print("¡Base de datos poblada con exito para SSPILLOWY Pulse!")

asyncio.run(seed())
