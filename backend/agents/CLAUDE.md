# backend/agents

Owner: AI.

## Agent pattern
Every agent is a pure function: typed input in, typed output plus run metadata out.
No database access inside agents — the orchestrator loads context (company profile,
campaign config, retrieved KB chunks), calls the agent, and persists the `agent_runs` row.

```
run_agent(name, input, ctx: { org_id, company_profile, campaign_system_prompt, agent_prompt, prompt_version_id })
  -> { output, meta, reason, kb_chunk_ids }
```

One module per agent (`research/`, `fitment/`, `strategy/`, `personalisation/`, `conversation/`,
`voice/`, `follow_up/`). Each module ships its default prompt template and a CLI entry that runs
it on sample prospects with no DB or server, so prompts can be iterated quickly.

## Output schemas
See `docs/spec.md` section 12.3 for the typed input/output contract of each of the seven agents
(Research, ICP Fitment, Outreach Strategy, Personalisation, Conversation, Voice SDR, Follow-up).
Validate every model response against its schema before returning.
