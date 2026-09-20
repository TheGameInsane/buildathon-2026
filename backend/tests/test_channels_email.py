"""channels.email — smtplib is faked entirely, no real network."""

from __future__ import annotations

import smtplib

import pytest

from channels import email as email_channel
from channels.base import ChannelSendError, OutboundMessage

_CONFIG = {
    "host": "smtp.test.com",
    "port": 587,
    "username": "bot@test.com",
    "password": "secret",
    "from_address": "bot@test.com",
}


class _FakeSMTP:
    instances: list = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.login_args = None
        self.sent_message = None
        type(self).instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.sent_message = message


@pytest.fixture(autouse=True)
def _reset_instances():
    _FakeSMTP.instances = []
    yield


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    monkeypatch.setattr(email_channel.time, "sleep", lambda _seconds: None)


def test_send_success_sets_threading_headers_and_appends_compliance_text(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    message = OutboundMessage(to="prospect@example.com", subject="Hi", body="Hello there")

    result = email_channel.send(
        _CONFIG, message, sender_footer="Acme Inc", unsubscribe_text="Reply STOP to unsubscribe"
    )

    assert result.provider_id.startswith("<") and result.provider_id.endswith(">")
    assert result.thread_key == result.provider_id
    sent = _FakeSMTP.instances[0].sent_message
    assert sent["To"] == "prospect@example.com"
    assert sent["Message-ID"] == result.provider_id
    assert _FakeSMTP.instances[0].login_args == ("bot@test.com", "secret")
    body = sent.get_content()
    assert "Reply STOP to unsubscribe" in body
    assert "Acme Inc" in body


def test_compliance_text_is_not_duplicated_if_already_present(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    message = OutboundMessage(
        to="prospect@example.com", subject="Hi", body="Hello there.\n\nReply STOP to unsubscribe"
    )

    email_channel.send(_CONFIG, message, unsubscribe_text="Reply STOP to unsubscribe")

    body = _FakeSMTP.instances[0].sent_message.get_content()
    assert body.count("Reply STOP to unsubscribe") == 1


def test_reply_sets_in_reply_to_and_references(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    message = OutboundMessage(
        to="prospect@example.com", subject="Re: Hi", body="Following up",
        in_reply_to_provider_id="<abc123@smtp.test.com>",
    )

    email_channel.send(_CONFIG, message)

    sent = _FakeSMTP.instances[0].sent_message
    assert sent["In-Reply-To"] == "<abc123@smtp.test.com>"
    assert sent["References"] == "<abc123@smtp.test.com>"


def test_missing_config_raises_without_attempting_a_connection(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    message = OutboundMessage(to="x@example.com", subject="hi", body="hi")

    with pytest.raises(ChannelSendError):
        email_channel.send({"host": "smtp.test.com"}, message)
    assert _FakeSMTP.instances == []


def test_transient_failure_is_retried_then_succeeds(monkeypatch):
    attempts = {"n": 0}

    class _FlakySMTP(_FakeSMTP):
        def login(self, username, password):
            attempts["n"] += 1
            if attempts["n"] == 1:
                raise smtplib.SMTPServerDisconnected("connection reset")
            super().login(username, password)

    monkeypatch.setattr(smtplib, "SMTP", _FlakySMTP)
    message = OutboundMessage(to="x@example.com", subject="hi", body="hi")

    result = email_channel.send(_CONFIG, message)
    assert result.provider_id
    assert attempts["n"] == 2


def test_non_transient_failure_raises_without_retrying(monkeypatch):
    attempts = {"n": 0}

    class _AuthFailsSMTP(_FakeSMTP):
        def login(self, username, password):
            attempts["n"] += 1
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(smtplib, "SMTP", _AuthFailsSMTP)
    message = OutboundMessage(to="x@example.com", subject="hi", body="hi")

    with pytest.raises(ChannelSendError):
        email_channel.send(_CONFIG, message)
    assert attempts["n"] == 1  # a bad password is never worth retrying


def test_status_reports_failure_reason(monkeypatch):
    class _RejectingSMTP(_FakeSMTP):
        def login(self, username, password):
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(smtplib, "SMTP", _RejectingSMTP)

    connected, detail = email_channel.status(_CONFIG)
    assert connected is False
    assert "bad credentials" in detail or "535" in detail
