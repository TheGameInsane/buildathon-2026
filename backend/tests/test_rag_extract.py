"""Unit tests for rag.extract: text-in-file-out for every supported extension, and a
clear error (not a crash, not a silent empty document) for anything else."""

from __future__ import annotations

from io import BytesIO

import pytest
from docx import Document

from rag.extract import UnsupportedFileType, extract_text


def test_txt_round_trips_utf8_text():
    assert extract_text("notes.txt", "Hello, café ☕".encode()) == "Hello, café ☕"


def test_md_is_treated_like_plain_text():
    raw = b"# Heading\n\nSome content."
    assert extract_text("playbook.md", raw) == "# Heading\n\nSome content."


def test_docx_extracts_paragraph_text():
    doc = Document()
    doc.add_paragraph("First paragraph.")
    doc.add_paragraph("Second paragraph.")
    buf = BytesIO()
    doc.save(buf)

    assert extract_text("case-study.docx", buf.getvalue()) == "First paragraph.\nSecond paragraph."


def test_unsupported_extension_raises_a_clear_error():
    with pytest.raises(UnsupportedFileType):
        extract_text("spreadsheet.xlsx", b"whatever")


def test_no_extension_raises_a_clear_error():
    with pytest.raises(UnsupportedFileType):
        extract_text("README", b"whatever")
