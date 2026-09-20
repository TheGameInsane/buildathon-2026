"""The channel adapter interface (spec section 11, backend/channels/CLAUDE.md). Every
adapter exposes the same two functions — `send` and `status` — taking the
integration's already-decrypted config dict; nothing outside `channels/` ever touches
a provider's credentials or API directly.

Sandbox vs. live is decided by the caller (`orchestrator/step.py`), not the adapter: an
adapter is only ever invoked for an integration already in `live` mode. A `sandbox`
integration never reaches this module at all — the touch is recorded and nothing is
sent, per spec section 8.
"""

from __future__ import annotations

from dataclasses import dataclass


class ChannelSendError(Exception):
    """Raised after retries are exhausted. The caller marks the touch `failed` and
    backs off the prospect — this must never propagate as a crash."""


@dataclass
class OutboundMessage:
    to: str  # email address or E.164 phone number, depending on the channel
    subject: str | None
    body: str
    in_reply_to_provider_id: str | None = None  # threads an email as a reply


@dataclass
class SendResult:
    provider_id: str
    thread_key: str | None = None
