"""Eval runner (spec section 12.8): scores a prompt version against a labelled
`eval_sets` dataset and writes one row to `eval_results`. Covers the three eval types
the spec names explicitly: fitment accuracy, reply-intent accuracy, and personalisation
message quality (via the LLM judge).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from agents import conversation, fitment, personalisation
from db.connection import org_connection
from db.repository import OrgScopedRepo
from eval.llm_judge import judge_message

_CaseRunner = Callable[[str, dict, dict], tuple[Any, dict]]


@dataclass
class EvalRunResult:
    agent: str
    accuracy: float | None
    judge_scores: dict | None
    details: list[dict]


def _run_fitment_case(org_id: str, input_data: dict, expected: dict) -> tuple[bool, dict]:
    output, _meta = fitment.run(fitment.FitmentInput.model_validate(input_data), org_id=org_id)
    correct = output.verdict == expected.get("verdict")
    return correct, {"got": output.verdict, "expected": expected.get("verdict")}


def _run_conversation_case(org_id: str, input_data: dict, expected: dict) -> tuple[bool, dict]:
    output, _meta = conversation.run(
        conversation.ConversationInput.model_validate(input_data), org_id=org_id
    )
    correct = output.intent == expected.get("intent")
    return correct, {"got": output.intent, "expected": expected.get("intent")}


def _run_personalisation_case(org_id: str, input_data: dict, _expected: dict) -> tuple[float, dict]:
    output, _meta = personalisation.run(
        personalisation.PersonalisationInput.model_validate(input_data), org_id=org_id
    )
    scores, _judge_meta = judge_message(output.body, org_id=org_id)
    total = scores.personalisation + scores.accuracy + scores.clarity + scores.call_to_action
    return total / 4, {"message": output.body, "scores": scores.model_dump()}


_ACCURACY_AGENTS: dict[str, _CaseRunner] = {
    "fitment": _run_fitment_case,
    "conversation": _run_conversation_case,
}
_JUDGED_AGENTS: dict[str, _CaseRunner] = {
    "personalisation": _run_personalisation_case,
}


def run_eval(
    org_id: str,
    agent: str,
    *,
    campaign_id: str | None = None,
    prompt_version_id: str | None = None,
    dataset: str = "default",
) -> EvalRunResult:
    """Runs every `eval_sets` row for this org/agent (optionally scoped to a campaign)
    and writes the aggregate to `eval_results`. An empty dataset is a no-op result, not
    an error (empty-state rule)."""
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        filters: dict[str, Any] = {"agent": agent}
        if campaign_id is not None:
            filters["campaign_id"] = campaign_id
        cases = repo.list("eval_sets", filters=filters)

    if not cases:
        return EvalRunResult(agent=agent, accuracy=None, judge_scores=None, details=[])

    details: list[dict] = []
    accuracy: float | None = None
    judge_scores: dict | None = None

    if agent in _ACCURACY_AGENTS:
        run_case = _ACCURACY_AGENTS[agent]
        correct_count = 0
        for case in cases:
            correct, detail = run_case(org_id, case["input"], case["expected"])
            correct_count += int(correct)
            details.append(detail)
        accuracy = correct_count / len(cases)
    elif agent in _JUDGED_AGENTS:
        run_case = _JUDGED_AGENTS[agent]
        scores = []
        for case in cases:
            score, detail = run_case(org_id, case["input"], case["expected"])
            scores.append(score)
            details.append(detail)
        judge_scores = {"average": sum(scores) / len(scores), "scores": scores}
    else:
        raise ValueError(f"no eval runner registered for agent {agent!r}")

    result = EvalRunResult(
        agent=agent, accuracy=accuracy, judge_scores=judge_scores, details=details
    )

    with org_connection(org_id) as conn:
        OrgScopedRepo(conn, org_id).insert(
            "eval_results",
            {
                "agent": agent,
                "campaign_id": campaign_id,
                "prompt_version_id": prompt_version_id,
                "dataset": dataset,
                "accuracy": result.accuracy,
                "judge_scores": result.judge_scores,
                "details": {"cases": result.details},
            },
        )
    return result
