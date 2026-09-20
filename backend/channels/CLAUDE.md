# backend/channels

Owner: Software.

## Adapter interface
All channels share one interface and a per-integration `mode` of `live` or `sandbox`.
Sandbox mode logs the touch and does not call the provider. Credentials come from the
organization's `integrations` row, decrypted only inside the adapter, never returned or logged.

```ts
interface ChannelAdapter {
  channel: "email" | "whatsapp" | "call" | "linkedin";
  send(org: OrgContext, touch: Touch): Promise<{ provider_id: string }>;    // idempotent on touch.idempotency_key
  handleInbound(raw: unknown): Promise<InboundMessage[]>;                     // normalises to InboundMessage
  status(org: OrgContext): Promise<{ connected: boolean; detail: string }>;   // feeds integration status lights
}
```

## Sandbox mode
New integrations start in `sandbox`. An allowed action on a `sandbox` integration is recorded
as a touch but never sent to a provider. See `docs/spec.md` section 11 for the per-channel
implementation notes (email threading, WhatsApp webhook, voice provider, LinkedIn simulator,
calendar booking).
