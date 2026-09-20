"""The LLM wrapper (spec section 12.1). This is the only module allowed to import an
LLM SDK — every agent and every route calls `call_structured` here instead, so budget
checks, retries, JSON repair and cost logging all happen in exactly one place.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from typing import Literal, TypeVar

from openai import APIConnectionError, APIStatusError, OpenAI
from pydantic import BaseModel, ValidationError

from ai.budget import BudgetExceededError, check_budget
from ai.pricing import cost_usd

__all__ = [
    "AgentOutputError",
    "BudgetExceededError",
    "RunMeta",
    "call_structured",
    "embed",
]

T = TypeVar("T", bound=BaseModel)
Tier = Literal["small", "strong"]

_REQUEST_TIMEOUT_S = 45.0  # spec section 12.1, item 3: 45s per attempt
_MAX_REPAIR_ATTEMPTS = 1  # spec item 5: retry once on schema validation failure
_MAX_TRANSIENT_RETRIES = 2  # spec item 8: retry transient HTTP errors with backoff


class AgentOutputError(Exception):
    """Raised when the model call fails outright, or its output still fails schema
    validation after one repair attempt. Callers must fall back safely (spec section
    12.1, item 6) — for example Strategy returning `escalate` — never crash."""


@dataclass
class RunMeta:
    model: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    latency_ms: int
    attempts: int
    status: Literal["ok", "repaired", "fallback"]


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set")
    return value


def _client() -> OpenAI:
    return OpenAI(
        base_url=_env("LLM_BASE_URL"),
        api_key=_env("LLM_API_KEY"),
        timeout=_REQUEST_TIMEOUT_S,
        max_retries=0,  # the wrapper retries explicitly below, with its own cap and backoff
    )


def _model_for(tier: Tier) -> str:
    return _env("MODEL_SMALL" if tier == "small" else "MODEL_STRONG")


def _strip_fences(text: str) -> str:
    """Model output is occasionally wrapped in a ```json ... ``` fence even when asked
    for JSON output only (spec item 4)."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def _is_transient(exc: Exception) -> bool:
    """429, 5xx, and connection/timeout failures are worth retrying; anything else
    (bad request, auth, schema-adjacent errors) is not."""
    if isinstance(exc, APIConnectionError):  # covers APITimeoutError too, it subclasses this
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code == 429 or exc.status_code >= 500
    return False


def call_structured(
    *,
    org_id: str | None,
    system: str,
    user: str,
    schema: type[T],
    tier: Tier,
    temperature: float = 0.2,
) -> tuple[T, RunMeta]:
    """Calls the model and validates its JSON output against `schema`. See docs/spec.md
    section 12.1 for the full contract:

    1. Checks the org's remaining monthly AI budget first — raises BudgetExceededError,
       which the caller turns into a `held` action, never a crash. `org_id=None` skips
       this (and needs no database at all): every agent's CLI entry runs with no DB or
       server (backend/agents/CLAUDE.md), so it calls `call_structured` with no org_id.
       The orchestrator always passes a real org_id, so production calls are never
       unbudgeted.
    2. Appends the schema's JSON shape to the user message and asks for JSON output.
    3. Retries transient HTTP errors (429, 5xx, timeouts) with backoff.
    4. Strips code fences and validates against the schema.
    5. On validation failure, retries once with the validation error appended.
    6. Raises AgentOutputError if it still fails — the caller falls back safely.
    7. Cost is tokens_in x input price + tokens_out x output price from the price table.
    """
    if org_id is not None:
        check_budget(org_id)

    model = _model_for(tier)
    schema_json = json.dumps(schema.model_json_schema())
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": (
                f"{user}\n\nReturn ONLY JSON matching this schema, no prose, no code fences:\n"
                f"{schema_json}"
            ),
        },
    ]

    client = _client()
    status: Literal["ok", "repaired"] = "ok"
    transient_retries_left = _MAX_TRANSIENT_RETRIES
    repair_attempts_left = _MAX_REPAIR_ATTEMPTS
    attempts = 0
    last_error: Exception | None = None

    while True:
        attempts += 1
        t0 = time.monotonic()
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=messages,
            )
        except Exception as exc:  # noqa: BLE001 - provider SDK raises several exception types
            if _is_transient(exc) and transient_retries_left > 0:
                transient_retries_left -= 1
                time.sleep(2 ** (_MAX_TRANSIENT_RETRIES - transient_retries_left))
                continue
            raise AgentOutputError(f"LLM call failed for org {org_id}: {exc}") from exc

        latency_ms = int((time.monotonic() - t0) * 1000)
        raw_text = response.choices[0].message.content or ""
        usage = response.usage
        tokens_in = usage.prompt_tokens if usage else 0
        tokens_out = usage.completion_tokens if usage else 0

        try:
            parsed = schema.model_validate_json(_strip_fences(raw_text))
        except ValidationError as exc:
            last_error = exc
            if repair_attempts_left > 0:
                repair_attempts_left -= 1
                status = "repaired"
                messages.append({"role": "assistant", "content": raw_text})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            f"Your last answer was invalid: {exc}. Return corrected JSON only."
                        ),
                    }
                )
                continue
            raise AgentOutputError(
                f"Invalid output after retries for org {org_id}: {last_error}"
            ) from exc

        return parsed, RunMeta(
            model=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost_usd(model, tokens_in, tokens_out),
            latency_ms=latency_ms,
            attempts=attempts,
            status=status,
        )


# Must match kb_chunks.embedding's width (db/migrations/0005_kb_chunks.sql).
_EMBED_DIMENSIONS = 1536


def embed(texts: list[str]) -> list[list[float]]:
    """Embeds a batch of texts for RAG ingestion/retrieval. Empty input returns []
    (empty-state rule) without a network call.

    `dimensions` pins the output width to what `kb_chunks.embedding` is actually sized
    for, regardless of which provider's native width `EMBED_MODEL` produces (OpenAI's
    text-embedding-3-* and Gemini's gemini-embedding-001 both support truncating to a
    requested width via this same OpenAI-compatible param) - a schema change is the
    only thing that should ever require re-embedding existing chunks, not a model swap.
    """
    if not texts:
        return []
    model = _env("EMBED_MODEL")
    response = _client().embeddings.create(model=model, input=texts, dimensions=_EMBED_DIMENSIONS)
    return [item.embedding for item in response.data]
