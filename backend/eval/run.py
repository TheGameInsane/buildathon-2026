"""CLI entry (spec section 12.8): `python -m eval.run --agent fitment --org <org_id>`."""

from __future__ import annotations

import argparse
import json

from eval.runner import run_eval


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run an eval and write its result to eval_results."
    )
    parser.add_argument(
        "--agent", required=True, choices=["fitment", "conversation", "personalisation"]
    )
    parser.add_argument("--org", required=True, help="org_id to run the eval against")
    parser.add_argument(
        "--campaign", default=None, help="restrict to one campaign's eval_sets rows"
    )
    parser.add_argument(
        "--prompt-version", default=None, help="prompt_version_id to record against"
    )
    parser.add_argument("--dataset", default="default", help="label stored on the eval_results row")
    args = parser.parse_args()

    result = run_eval(
        args.org,
        args.agent,
        campaign_id=args.campaign,
        prompt_version_id=args.prompt_version,
        dataset=args.dataset,
    )
    summary = {
        "agent": result.agent,
        "accuracy": result.accuracy,
        "judge_scores": result.judge_scores,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
