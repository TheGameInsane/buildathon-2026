import { useState } from "react"
import { CheckCircle2, FileText, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useKnowledgeDocs, useUploadKnowledgeDoc } from "@/hooks/use-knowledge"
import { timeAgo } from "@/lib/format"
import { useCampaignContext } from "@/pages/use-campaign-context"
import type { DocType } from "@/types/domain"

const DOC_TYPES: DocType[] = ["Case study", "Playbook", "Objection handling", "Example email", "ICP definition"]
const ACCEPT = ".pdf,.docx,.txt,.md"
const ACCEPT_LABEL = "PDF, DOCX, TXT, or MD"

function AddDocumentDialog({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false)
  const [docType, setDocType] = useState<DocType>("Playbook")
  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadKnowledgeDoc(campaignId)

  const reset = () => {
    setDocType("Playbook")
    setFile(null)
    upload.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus /> Add document
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add knowledge document</DialogTitle>
          <DialogDescription>Upload a file — it's chunked and embedded automatically.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)} disabled={upload.isPending}>
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

          {upload.isSuccess ? (
            <div className="flex flex-col items-center gap-1.5 rounded-[10px] border border-status-live/30 bg-status-live/10 p-6 text-center">
              <CheckCircle2 className="size-6 text-status-live" />
              <p className="text-sm font-medium text-text-primary">{file?.name} uploaded</p>
              <p className="text-xs text-text-secondary">It's being chunked and embedded into the knowledge base.</p>
            </div>
          ) : file ? (
            <div className="flex items-center justify-between gap-2 rounded-[10px] border border-border bg-canvas p-3">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-text-primary">
                <FileText className="size-4 shrink-0 text-text-secondary" />
                <span className="truncate">{file.name}</span>
              </span>
              {!upload.isPending && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                  className="shrink-0 text-text-secondary hover:text-text-primary"
                >
                  <X className="size-4" />
                </button>
              )}
              {upload.isPending && <span className="shrink-0 text-xs text-text-secondary">Uploading…</span>}
            </div>
          ) : (
            <FileDropzone accept={ACCEPT} acceptLabel={ACCEPT_LABEL} onFileSelected={setFile} />
          )}

          {upload.isError && (
            <p className="text-xs text-status-attention">{upload.error.message}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {upload.isSuccess ? "Close" : "Cancel"}
          </Button>
          {!upload.isSuccess && (
            <Button
              type="button"
              disabled={!file || upload.isPending}
              onClick={() => file && upload.mutate({ file, docType })}
            >
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          )}
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
                  <span className="inline-flex items-center gap-1.5 text-sm text-text-primary">
                    <FileText className="size-3.5 text-text-secondary" />
                    {doc.title}
                  </span>
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
