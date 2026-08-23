from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SSPILLOWY API Core",
    description="Software Security Platform for Intelligent, Low-latency Oversight & Warning Yield",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "SSPILLOWY API",
        "version": "0.1.0"
    }

@app.get("/api/v1/ping", tags=["Diagnostics"])
async def ping():
    return {"message": "SSPILLOWY Gateway is operational"}
