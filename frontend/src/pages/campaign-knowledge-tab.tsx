import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAddKnowledgeDoc, useKnowledgeDocs } from "@/hooks/use-knowledge"
import { timeAgo } from "@/lib/format"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { DocType } from "@/types/domain"

const DOC_TYPES: DocType[] = ["Case study", "Playbook", "Objection handling", "Example email", "ICP definition"]

function AddDocumentDialog({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<DocType>("Playbook")
  const [content, setContent] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const addDoc = useAddKnowledgeDoc(campaignId)

  const canSave = title.trim().length > 0 && content.trim().length > 0

  const reset = () => {
    setTitle("")
    setDocType("Playbook")
    setContent("")
    setSourceUrl("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus /> Add document
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add knowledge document</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-content">Content</Label>
            <Textarea id="doc-content" value={content} onChange={(e) => setContent(e.target.value)} rows={5} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-source">Source URL (optional)</Label>
            <Input id="doc-source" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              addDoc.mutate({ title, docType, sourceUrl })
              reset()
              setOpen(false)
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CampaignKnowledgeTab() {
  const { campaign } = useCampaignContext()
  const { data: docs, isLoading } = useKnowledgeDocs(campaign.id)

  const grouped = DOC_TYPES.map((docType) => ({
    docType,
    docs: docs?.filter((d) => d.docType === docType) ?? [],
  })).filter((group) => group.docs.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AddDocumentDialog campaignId={campaign.id} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !docs?.length ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
          <p className="text-sm text-text-secondary">No documents yet.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.docType} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-text-secondary">{group.docType}</p>
            <div className="flex flex-col divide-y divide-border rounded-[10px] border border-border bg-surface">
              {group.docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3">
                  <a href={doc.sourceUrl} className="text-sm text-text-primary hover:text-brand-600 hover:underline">
                    {doc.title}
                  </a>
                  <span className="shrink-0 text-xs text-text-secondary">Updated {timeAgo(doc.updatedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
