export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-border text-center">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">This screen hasn't been built yet.</p>
    </div>
  )
}
