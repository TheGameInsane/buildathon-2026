"""Client and payload normalisation for the DronaHQ ICP discovery agent.

The agent's response format is deliberately normalised here, rather than leaking a
vendor-specific shape into the database or UI. It accepts the common envelope keys
(`prospects`, `results`, `data`, `records`, or `candidates`) and common field aliases.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

from ai.llm import AgentOutputError, BudgetExceededError, call_structured

DEFAULT_WEBHOOK_URL = "https://agents-backend.dronahq.com/webhook/f872727f-d0da-4cc2-b340-9554bbc6d7d1"

# Synthetic ICP-discovery dataset (docs/prospects.json, repo root) — every person,
# company, domain and phone number in it is fictional (see its own "meta" block).
# `simulate_discovery` is the local stand-in for a real DronaHQ agent, used whenever
# DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL isn't configured (api/prospects.py's discover route).
_DEMO_PROSPECTS_PATH = Path(__file__).resolve().parents[2] / "docs" / "prospects.json"
_DEMO_CAMPAIGN_KEYS = ("A", "B", "C", "D")

_EXTRACTION_SYSTEM = """You extract sales prospects from a DronaHQ web-discovery agent output.
Return only people explicitly identified in the supplied text. Do not invent people,
emails, companies, roles, or LinkedIn URLs. Job-search pages, company pages, and
generic role listings are evidence of zero prospects, not prospects themselves. Use
null for a person field that is not explicitly supplied."""


class DiscoveryError(Exception):
    """The upstream discovery agent could not be called or returned unusable JSON."""


class ExtractedProspect(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    company: str | None = None
    domain: str | None = None
    role: str | None = None
    country: str | None = None


class ProspectExtraction(BaseModel):
    prospects: list[ExtractedProspect] = Field(default_factory=list)


def invoke_discovery(payload: dict[str, Any]) -> Any:
    """Call the configured DronaHQ discovery webhook with a bounded timeout."""
    url = os.environ.get("DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL", DEFAULT_WEBHOOK_URL)
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        timeout = float(os.environ.get("DRONAHQ_DISCOVERY_TIMEOUT_SECONDS", "45"))
        # The target is deployment configuration, never supplied by a browser request.
        with urlopen(request, timeout=timeout) as response:  # noqa: S310
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise DiscoveryError(f"The discovery agent returned HTTP {exc.code}.") from exc
    except (URLError, TimeoutError) as exc:
        raise DiscoveryError("Could not reach the DronaHQ discovery agent.") from exc
    except json.JSONDecodeError as exc:
        raise DiscoveryError("The discovery agent did not return valid JSON.") from exc


def extract_prospects(response: Any, *, org_id: str | None = None) -> list[dict[str, Any]]:
    """Return structured leads or use the LLM to extract them from narrative output."""
    records: Any = response
    if isinstance(response, Mapping):
        envelope_keys = ("prospects", "results", "data", "records", "candidates")
        records = next(
            (response[key] for key in envelope_keys if isinstance(response.get(key), list)),
            None,
        )
    if not isinstance(records, list):
        narrative = response.get("response") if isinstance(response, Mapping) else response
        if not isinstance(narrative, str) or not narrative.strip():
            return []
        try:
            extracted, _meta = call_structured(
                org_id=org_id,
                system=_EXTRACTION_SYSTEM,
                user=f"DronahQ agent output:\n{narrative}",
                schema=ProspectExtraction,
                tier="small",
            )
        except (AgentOutputError, BudgetExceededError, RuntimeError) as exc:
            raise DiscoveryError("Could not extract prospects from the discovery output.") from exc
        return [prospect.model_dump(exclude_none=True) for prospect in extracted.prospects]
    return [normalise_prospect(row) for row in records if isinstance(row, Mapping)]


def normalise_prospect(row: Mapping[str, Any]) -> dict[str, str | None]:
    """Map agent-specific names into the platform's prospect schema."""
    def value(*keys: str) -> str | None:
        for key in keys:
            item = row.get(key)
            if item is not None and str(item).strip():
                return str(item).strip()
        return None

    full_name = value("full_name", "name", "person_name", "contact_name")
    if not full_name:
        first, last = value("first_name"), value("last_name")
        full_name = " ".join(part for part in (first, last) if part) or None
    return {
        "full_name": full_name,
        "email": value("email", "email_address", "work_email"),
        "phone": value("phone", "phone_number", "mobile"),
        "linkedin_url": value("linkedin_url", "linkedin", "linkedin_profile"),
        "company": value("company", "company_name", "organization"),
        "domain": value("domain", "company_domain", "website"),
        "role": value("role", "title", "job_title", "position"),
        "country": value("country", "location", "region", "hq_country"),
    }


@lru_cache(maxsize=1)
def _demo_prospect_pool() -> dict[str, list[dict[str, str | None]]]:
    """Loads and normalises docs/prospects.json once per process, grouped by its
    `campaign_key`. Missing file (e.g. a deployment that never checked it out) just
    means an empty pool - callers fall back from there, same as any other empty state."""
    if not _DEMO_PROSPECTS_PATH.exists():
        return {}
    with _DEMO_PROSPECTS_PATH.open(encoding="utf-8") as f:
        rows = json.load(f).get("prospects", [])

    grouped: dict[str, list[dict[str, str | None]]] = {}
    for row in rows:
        flat = {
            "full_name": row.get("full_name"),
            "email": row.get("email"),
            "phone": row.get("phone"),
            "linkedin_url": row.get("linkedin_url"),
            "company": (row.get("company") or {}).get("name"),
            "domain": (row.get("company") or {}).get("domain"),
            "role": row.get("job_title"),
            "country": (row.get("location") or {}).get("country"),
        }
        grouped.setdefault(row.get("campaign_key") or "A", []).append(flat)
    return grouped


def simulate_discovery(
    campaign_id: str, *, exclude_emails: set[str], limit: int
) -> list[dict[str, str | None]]:
    """Local stand-in for a real DronaHQ ICP-discovery agent: docs/prospects.json,
    sliced deterministically so the same real campaign always draws from the same
    simulated ICP group, and `exclude_emails` so a repeated click surfaces new people
    instead of re-serving the same batch."""
    pool = _demo_prospect_pool()
    if not pool:
        return []
    key = _DEMO_CAMPAIGN_KEYS[
        int(hashlib.sha256(campaign_id.encode()).hexdigest(), 16) % len(_DEMO_CAMPAIGN_KEYS)
    ]
    rows = pool.get(key) or next(iter(pool.values()))
    unseen = [r for r in rows if not r.get("email") or r["email"].lower() not in exclude_emails]
    return unseen[:limit]
