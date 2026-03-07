from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the Cortex Backend FastAPI Application
app = FastAPI(
    title="Cortex Local AI Layer",
    description="Offline-first AI operating layer by SynapseX",
    version="1.0.0"
)

# Configure CORS for Electron App access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be tightened for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to Cortex Backend"}

@app.get("/health")
def health_check():
    return {"status": "ok", "system": "Cortex Core Services Running"}
