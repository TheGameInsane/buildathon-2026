"""Prompt template loading and rendering (spec section 12.4).

Default prompt templates ship as `.md` files in a `prompts/` directory next to the
module that uses them (`agents/prompts/*.md`, `rag/prompts/*.md`) so they can be edited
without touching code. Rendering is a plain `{{name}}` substitution, not a templating
engine: prompt text is trusted content (org admin or shipped defaults), not something
that needs conditionals or loops.
"""

from __future__ import annotations

import re
from pathlib import Path

_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")


def load_prompt(caller_file: str, name: str) -> str:
    """Loads `<name>.md` from the `prompts/` directory next to `caller_file`. Call as
    `load_prompt(__file__, "research")` from a module in `agents/` or `rag/`."""
    prompts_dir = Path(caller_file).resolve().parent / "prompts"
    return (prompts_dir / f"{name}.md").read_text(encoding="utf-8").strip()


def render_template(template: str, **values: str) -> str:
    """Replaces every `{{name}}` with `values[name]`. A placeholder with no matching
    value renders as an empty string rather than raising, so a missing optional field
    never crashes prompt rendering."""
    return _PLACEHOLDER.sub(lambda m: str(values.get(m.group(1), "")), template)


def render_system_prompt(**values: str) -> str:
    """Renders the campaign-level system prompt (spec section 12.4): company_name,
    company_one_liner, offer, icp_summary, tone, language, channel_policy_text,
    campaign_name, rep_signature, sender_footer. The orchestrator prepends this to
    every agent call."""
    return render_template(load_prompt(__file__, "system"), **values)
