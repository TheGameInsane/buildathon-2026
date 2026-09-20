"""Twilio WhatsApp adapter (spec section 11). Sandbox mode on Twilio's side reaches
only pre-joined numbers — fine for the hackathon, and avoids India SMS DLT
registration. Talks to Twilio's REST API directly over HTTP with Basic Auth; one
endpoint doesn't warrant adding the full `twilio` SDK as a dependency.

`config` is the integration's decrypted config: `{account_sid, auth_token,
from_number}`. Numbers are plain E.164 (no `whatsapp:` prefix) — that's added here.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode

from channels.base import ChannelSendError, OutboundMessage, SendResult

_TIMEOUT_S = 20
_MAX_RETRIES = 2
_RETRYABLE_HTTP_CODES = {429, 500, 502, 503, 504}
_API_BASE = "https://api.twilio.com/2010-04-01"


def _auth_header(account_sid: str, auth_token: str) -> str:
    token = b64encode(f"{account_sid}:{auth_token}".encode()).decode()
    return f"Basic {token}"


def send(config: dict, message: OutboundMessage) -> SendResult:
    account_sid = config.get("account_sid")
    auth_token = config.get("auth_token")
    from_number = config.get("from_number")
    if not (account_sid and auth_token and from_number):
        raise ChannelSendError("whatsapp integration is missing account_sid/auth_token/from_number")

    url = f"{_API_BASE}/Accounts/{account_sid}/Messages.json"
    data = urllib.parse.urlencode(
        {"From": f"whatsapp:{from_number}", "To": f"whatsapp:{message.to}", "Body": message.body}
    ).encode()

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        request = urllib.request.Request(url, data=data, method="POST")
        request.add_header("Authorization", _auth_header(account_sid, auth_token))
        request.add_header("Content-Type", "application/x-www-form-urlencoded")
        try:
            with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
                body = json.loads(response.read())
            return SendResult(provider_id=body["sid"])
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in _RETRYABLE_HTTP_CODES or attempt >= _MAX_RETRIES:
                break
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt >= _MAX_RETRIES:
                break
        time.sleep(2**attempt)
    raise ChannelSendError(f"WhatsApp send failed: {last_error}") from last_error


def status(config: dict) -> tuple[bool, str]:
    account_sid, auth_token = config.get("account_sid"), config.get("auth_token")
    if not (account_sid and auth_token):
        return False, "Missing account_sid/auth_token"
    url = f"{_API_BASE}/Accounts/{account_sid}.json"
    request = urllib.request.Request(url, method="GET")
    request.add_header("Authorization", _auth_header(account_sid, auth_token))
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_S):
            return True, "Connected"
    except Exception as exc:  # noqa: BLE001 - report any failure reason back to the caller
        return False, str(exc)
