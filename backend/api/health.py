from fastapi import APIRouter

router = APIRouter(tags=["ops"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check. No auth, no dependencies — used by uptime checks and the platform."""
    return {"status": "ok"}
