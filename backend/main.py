import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.agents import router as agents_router
from api.auth import router as auth_router
from api.campaigns import router as campaigns_router
from api.controls import router as controls_router
from api.errors import install_error_handlers
from api.health import router as health_router
from api.inbox import router as inbox_router
from api.integrations import router as integrations_router
from api.kb import router as kb_router
from api.org import router as org_router
from api.platform import router as platform_router
from api.prompts import router as prompts_router
from api.prospects import router as prospects_router
from api.reps import router as reps_router
from api.suppression import router as suppression_router
from api.webhooks import router as webhooks_router

load_dotenv(override=True)  # override any existing env vars with .env file

app = FastAPI(title="Autonomous SDR Platform API")
install_error_handlers(app)

# The frontend (a separate Vite dev server / static host) calls this API cross-origin.
# CORS_ORIGINS is a comma-separated allowlist; defaults cover the standard local Vite
# dev ports so `npm run dev` works against a local backend with no extra setup.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_raw_origins = os.environ.get("CORS_ORIGINS", _default_origins).split(",")
_cors_origins = [origin.strip() for origin in _raw_origins if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(platform_router)
app.include_router(org_router)
app.include_router(campaigns_router)
app.include_router(agents_router)
app.include_router(prompts_router)
app.include_router(prospects_router)
app.include_router(kb_router)
app.include_router(inbox_router)
app.include_router(controls_router)
app.include_router(integrations_router)
app.include_router(reps_router)
app.include_router(suppression_router)
app.include_router(webhooks_router)
