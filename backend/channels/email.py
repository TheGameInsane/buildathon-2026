"""SMTP email adapter (spec section 11). Sends over SMTP with STARTTLS, sets
Message-ID/In-Reply-To/References for threading, and always appends the tenant's
sender footer and unsubscribe line — in code, not left to the model, so a compliance
line is never missing even if Personalisation's draft happened to include one already
(the rare cosmetic duplicate is the safe failure mode, a missing line is not).

`config` is the integration's decrypted config (`tenancy.crypto.decrypt_secret`):
`{host, port, username, password, from_address}`. IMAP polling for inbound replies
isn't implemented — see docs/api_contract.md.
"""

from __future__ import annotations

import smtplib
import ssl
import time
import uuid
from email.message import EmailMessage

from channels.base import ChannelSendError, OutboundMessage, SendResult

_TIMEOUT_S = 20
_MAX_RETRIES = 2
_TRANSIENT_SMTP_CODES = {421, 450, 451, 452}  # temporary failures worth retrying


_TRANSIENT_EXCEPTION_TYPES = (
    OSError,
    TimeoutError,
    smtplib.SMTPConnectError,
    smtplib.SMTPServerDisconnected,
)


def _is_transient(exc: Exception) -> bool:
    if isinstance(exc, smtplib.SMTPResponseException):
        return exc.smtp_code in _TRANSIENT_SMTP_CODES
    return isinstance(exc, _TRANSIENT_EXCEPTION_TYPES)


def _build_message(
    config: dict, message: OutboundMessage, *, sender_footer: str, unsubscribe_text: str
) -> tuple[EmailMessage, str]:
    body = message.body
    if unsubscribe_text and unsubscribe_text not in body:
        body = f"{body}\n\n{unsubscribe_text}"
    if sender_footer and sender_footer not in body:
        body = f"{body}\n\n{sender_footer}"

    domain = str(config.get("host", "localhost")).split(":")[0]
    message_id = f"<{uuid.uuid4()}@{domain}>"

    email_message = EmailMessage()
    email_message["Subject"] = message.subject or ""
    email_message["From"] = config.get("from_address") or config.get("username", "")
    email_message["To"] = message.to
    email_message["Message-ID"] = message_id
    if message.in_reply_to_provider_id:
        email_message["In-Reply-To"] = message.in_reply_to_provider_id
        email_message["References"] = message.in_reply_to_provider_id
    email_message.set_content(body)
    return email_message, message_id


def send(
    config: dict, message: OutboundMessage, *, sender_footer: str = "", unsubscribe_text: str = ""
) -> SendResult:
    host, username, password = config.get("host"), config.get("username"), config.get("password")
    if not (host and username and password):
        raise ChannelSendError("email integration is missing host/username/password")
    port = int(config.get("port", 587))

    email_message, message_id = _build_message(
        config, message, sender_footer=sender_footer, unsubscribe_text=unsubscribe_text
    )

    last_error: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=_TIMEOUT_S) as smtp:
                smtp.starttls(context=context)
                smtp.login(username, password)
                smtp.send_message(email_message)
            return SendResult(provider_id=message_id, thread_key=message_id)
        except Exception as exc:  # noqa: BLE001 - smtplib raises many distinct exception types
            last_error = exc
            if _is_transient(exc) and attempt < _MAX_RETRIES:
                time.sleep(2**attempt)
                continue
            break
    raise ChannelSendError(f"SMTP send failed: {last_error}") from last_error


def status(config: dict) -> tuple[bool, str]:
    """A connection test only — logs in, sends nothing."""
    host, username, password = config.get("host"), config.get("username"), config.get("password")
    if not (host and username and password):
        return False, "Missing host/username/password"
    port = int(config.get("port", 587))
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=_TIMEOUT_S) as smtp:
            smtp.starttls(context=context)
            smtp.login(username, password)
        return True, "Connected"
    except Exception as exc:  # noqa: BLE001 - report any failure reason back to the caller
        return False, str(exc)
