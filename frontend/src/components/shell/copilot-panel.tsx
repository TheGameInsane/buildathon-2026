import { useState, type FormEvent } from "react"
import { Bot, MessageSquare, PanelRightClose, PanelRightOpen, Send } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface CopilotMessage {
  id: string
  from: "manager" | "copilot"
  text: string
}

const initialMessages: CopilotMessage[] = [
  {
    id: "seed",
    from: "copilot",
    text: "I'm the Manager Copilot. I can read anything across your campaigns, and pause, resume, or approve actions with your confirmation.",
  },
]

function useCopilotThread() {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState("")

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), from: "manager", text: draft }])
    setDraft("")
  }

  return { messages, draft, setDraft, send }
}

function CopilotThread() {
  const { messages, draft, setDraft, send } = useCopilotThread()

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              m.from === "copilot" ? "bg-canvas text-text-primary" : "ml-auto bg-brand-600 text-white",
            )}
          >
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the Copilot…"
          aria-label="Message the Manager Copilot"
        />
        <Button type="submit" size="icon" aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  )
}

export interface CopilotPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Persistent right-side panel on desktop; a floating button + full-screen sheet below ~768px. */
export function CopilotPanel({ open, onOpenChange }: CopilotPanelProps) {
  return (
    <>
      {/* Desktop: persistent collapsible panel */}
      <div
        className={cn(
          "hidden shrink-0 flex-col border-l border-border bg-surface transition-[width] md:flex",
          open ? "w-80" : "w-11",
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-2">
          {open && (
            <span className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-text-primary">
              <Bot className="size-4" /> Copilot
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={() => onOpenChange(!open)}
            aria-label={open ? "Collapse Copilot" : "Expand Copilot"}
          >
            {open ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </div>
        {open && (
          <div className="min-h-0 flex-1">
            <CopilotThread />
          </div>
        )}
      </div>

      {/* Mobile: floating action button opening a full-screen sheet */}
      <div className="fixed right-4 bottom-4 z-40 md:hidden">
        <Button
          type="button"
          size="icon-lg"
          className="rounded-full shadow-lg"
          onClick={() => onOpenChange(true)}
          aria-label="Open Copilot"
        >
          <MessageSquare />
        </Button>
      </div>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] p-0 md:hidden">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="inline-flex items-center gap-1.5">
              <Bot className="size-4" /> Copilot
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1">
            <CopilotThread />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
