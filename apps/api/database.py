import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_SERVER = os.getenv("POSTGRES_SERVER", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "sspillowy_db")

# Prefer DATABASE_URL (Supabase / Railway). Example Supabase:
# postgresql://postgres.xxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
_raw_url = os.getenv("DATABASE_URL", "").strip()
if not _raw_url:
    _raw_url = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
        f"@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )

# SQLAlchemy + psycopg2
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = _raw_url
USING_SQLITE = False

connect_args: dict = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
    USING_SQLITE = True
elif "postgresql" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
    # Supabase / cloud Postgres need TLS
    if "supabase" in DATABASE_URL or "pooler" in DATABASE_URL:
        sep = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{sep}sslmode=require"

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args=connect_args,
    )
except Exception:
    USING_SQLITE = True
    engine = create_engine(
        "sqlite:///./sspillowy.db",
        connect_args={"check_same_thread": False},
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> bool:
    """Create tables if missing. Returns True if DB is reachable."""
    import models  # noqa: F401 — register models on Base.metadata

    try:
        Base.metadata.create_all(bind=engine)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            # Migración suave: columna de login manual (proyectos ya creados)
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT"))
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ"
                )
            )
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT"))
            conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ")
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS pillow_daily_usage (
                      user_key TEXT NOT NULL,
                      usage_date DATE NOT NULL,
                      credits_used INTEGER DEFAULT 0,
                      PRIMARY KEY (user_key, usage_date)
                    )
                    """
                )
            )
            # Usuarios ya existentes (SSO o pruebas) siguen pudiendo entrar
            conn.execute(text("UPDATE users SET email_verified = TRUE WHERE email_verified IS NOT TRUE"))
            conn.commit()
        return True
    except Exception as exc:
        print(f"[sspillowy] DB init failed: {exc}")
        return False


def db_ping() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
