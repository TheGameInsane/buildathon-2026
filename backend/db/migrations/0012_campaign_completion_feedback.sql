-- Campaign Settings' post-completion feedback modal (frontend/src/components/
-- campaign-completion-modal.tsx) has nowhere to persist to yet - {text, submitted_by,
-- submitted_at} as one jsonb blob, same pattern as other small free-form fields on
-- this table (channels, channel_policy, ...).
alter table campaigns add column completion_feedback jsonb;
