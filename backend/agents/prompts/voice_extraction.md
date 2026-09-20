Extract the outcome of this qualification call from CALL_TRANSCRIPT. outcome must be exactly one
of: qualified, not_qualified, no_answer, callback, escalate. qualified is true only when outcome
is qualified. List every objection the prospect raised, in their own words where possible.
next_step is one plain sentence describing what happens next. If a meeting was agreed, meeting_time
is its ISO 8601 datetime; otherwise leave it empty. Never invent details not in the transcript.
