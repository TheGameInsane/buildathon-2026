import { useRef, useState, type DragEvent } from "react"
import { UploadCloud } from "lucide-react"
import { cn } from "cn"

export interface FileDropzoneProps {
  /** Comma-separated extensions/MIME types, passed straight to the hidden `<input accept>`. */
  accept: string
  /** Human-readable version of `accept`, e.g. "PDF, DOCX, TXT, or MD". */
  acceptLabel: string
  onFileSelected: (file: File) => void
  disabled?: boolean
  className?: string
}

/**
 * A visible drop zone that accepts a dragged file, plus a regular click-to-browse
 * fallback — the one drag-and-drop control every file upload in the product uses
 * (spec: "wherever the product has a file upload control, add drag and drop").
 */
export function FileDropzone({ accept, acceptLabel, onFileSelected, disabled, className }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) onFileSelected(file)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed p-6 text-center transition-colors",
        isDragging ? "border-brand-accent bg-brand-50" : "border-border bg-canvas hover:border-brand-600/40",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <UploadCloud className={cn("size-6", isDragging ? "text-brand-accent" : "text-text-secondary")} />
      <p className="text-sm font-medium text-text-primary">Drag and drop a file, or click to browse</p>
      <p className="text-xs text-text-secondary">{acceptLabel}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
          e.target.value = "" // lets the same file be re-selected after a failed upload
        }}
      />
    </div>
  )
}
