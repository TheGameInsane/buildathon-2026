"""One error shape everywhere (spec section 10): `{code, message, details}`, as the
top-level JSON body — not nested under FastAPI's default `{"detail": ...}` wrapper.
`tenancy.auth` already raises `HTTPException(detail={"code", "message", "details"})`;
the handlers here make that the actual response body for every route, including
FastAPI's own validation errors and any `NotFound` a repository call raises.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from db.repository import NotFound


def api_error(
    status_code: int, code: str, message: str, details: dict | None = None
) -> HTTPException:
    """Routes raise this for any business-logic error (invalid state transition,
    preflight not green, ...) so the response body always has the same shape."""
    body = {"code": code, "message": message, "details": details or {}}
    return HTTPException(status_code=status_code, detail=body)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        body = exc.detail
        if not (isinstance(body, dict) and {"code", "message"} <= body.keys()):
            body = {"code": "error", "message": str(exc.detail), "details": {}}
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(NotFound)
    async def _not_found_handler(_request: Request, exc: NotFound) -> JSONResponse:
        return JSONResponse(
            status_code=404, content={"code": "not_found", "message": str(exc), "details": {}}
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        body = {
            "code": "validation_error",
            "message": "Invalid request",
            "details": {"errors": exc.errors()},
        }
        return JSONResponse(status_code=422, content=body)
