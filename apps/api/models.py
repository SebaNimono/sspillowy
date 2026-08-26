import uuid
from sqlalchemy import Column, String, DateTime, func, ForeignKey
from database import Base

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url = Column(String, nullable=False)

class Scan(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id"), nullable=False)
    status = Column(String, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())