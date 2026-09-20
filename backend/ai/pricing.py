"""Model catalog and price table (spec section 12.1) — the "platform config" the LLM
wrapper prices every call against. USD per 1,000,000 tokens, input and output. These
are provider list prices for text generation, not anything about a tenant, so they stay
in code rather than a table: they are platform config, not tenant data.
"""

from __future__ import annotations

# model id -> (input $/1M tokens, output $/1M tokens). Add an entry whenever
# MODEL_SMALL, MODEL_STRONG or EMBED_MODEL points at a model not yet listed here.
_PRICES_USD_PER_MILLION: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "o4-mini": (1.10, 4.40),
    "text-embedding-3-small": (0.02, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
    # Gemini, via its OpenAI-compatible endpoint (LLM_BASE_URL) — free tier as of
    # docs/spec.md's provider choice, so listed at $0. Update if usage moves to a paid
    # tier or Google's pricing page lists these above free-tier limits.
    "gemini-3.8-flash": (0.0, 0.0),
    "gemini-2.5-pro": (0.0, 0.0),
    "gemini-embedding-001": (0.0, 0.0),
}


def cost_usd(model: str, tokens_in: int, tokens_out: int) -> float:
    """Cost = tokens_in x input price + tokens_out x output price (spec section 12.1).

    A model missing from the table prices at 0.0 rather than raising: an unpriced model
    must never block a call, only under-report its cost — and 0.0 on the agent_runs row
    is visible for follow-up, unlike silently guessing another model's price.
    """
    input_price, output_price = _PRICES_USD_PER_MILLION.get(model, (0.0, 0.0))
    return (tokens_in * input_price + tokens_out * output_price) / 1_000_000
