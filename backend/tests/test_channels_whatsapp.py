"""channels.whatsapp — urllib is faked entirely, no real network."""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.parse
import urllib.request

import pytest

from channels import whatsapp as whatsapp_channel
from channels.base import ChannelSendError, OutboundMessage

_CONFIG = {"account_sid": "AC123", "auth_token": "secret-token", "from_number": "+15550001111"}


class _FakeResponse:
    def __init__(self, body: dict):
        self._body = json.dumps(body).encode()

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    monkeypatch.setattr(whatsapp_channel.time, "sleep", lambda _seconds: None)


def test_send_success_returns_the_twilio_message_sid(monkeypatch):
    calls = []

    def _fake_urlopen(request, timeout=None):
        calls.append(request)
        return _FakeResponse({"sid": "SM123abc"})

    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen)
    message = OutboundMessage(to="+15559998888", subject=None, body="Hello there")

    result = whatsapp_channel.send(_CONFIG, message)

    assert result.provider_id == "SM123abc"
    assert len(calls) == 1
    body = urllib.parse.parse_qs(calls[0].data.decode())
    assert body["To"] == ["whatsapp:+15559998888"]
    assert body["From"] == ["whatsapp:+15550001111"]
    assert calls[0].get_header("Authorization").startswith("Basic ")


def test_missing_config_raises_without_a_network_call(monkeypatch):
    called = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: called.append(1))
    message = OutboundMessage(to="+15559998888", subject=None, body="hi")

    with pytest.raises(ChannelSendError):
        whatsapp_channel.send({"account_sid": "AC123"}, message)
    assert called == []


def test_retryable_http_error_is_retried_then_succeeds(monkeypatch):
    attempts = {"n": 0}

    def _fake_urlopen(request, timeout=None):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise urllib.error.HTTPError(
                "https://api.twilio.com/x", 503, "Service Unavailable", {}, io.BytesIO(b"")
            )
        return _FakeResponse({"sid": "SM999"})

    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen)
    message = OutboundMessage(to="+15559998888", subject=None, body="hi")

    result = whatsapp_channel.send(_CONFIG, message)
    assert result.provider_id == "SM999"
    assert attempts["n"] == 2


def test_non_retryable_http_error_raises_immediately(monkeypatch):
    attempts = {"n": 0}

    def _fake_urlopen(request, timeout=None):
        attempts["n"] += 1
        raise urllib.error.HTTPError(
            "https://api.twilio.com/x", 401, "Unauthorized", {}, io.BytesIO(b"")
        )

    monkeypatch.setattr(urllib.request, "urlopen", _fake_urlopen)
    message = OutboundMessage(to="+15559998888", subject=None, body="hi")

    with pytest.raises(ChannelSendError):
        whatsapp_channel.send(_CONFIG, message)
    assert attempts["n"] == 1  # bad credentials are never worth retrying


def test_status_reports_connected(monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: _FakeResponse({}))
    connected, detail = whatsapp_channel.status(_CONFIG)
    assert connected is True
