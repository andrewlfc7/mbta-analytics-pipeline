import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  text?: string;
}

export function Loading({ className, text = "Loading data..." }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
      </div>
      <p className="mt-4 text-sm text-content-muted">{text}</p>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl bg-surface-card border border-slate-700/50 animate-pulse", className)}>
      <div className="p-6">
        <div className="h-4 w-24 rounded bg-slate-700" />
        <div className="mt-3 h-8 w-32 rounded bg-slate-700" />
        <div className="mt-4 h-2 w-full rounded bg-slate-700" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl bg-surface-card border border-slate-700/50 animate-pulse p-6">
      <div className="h-4 w-48 rounded bg-slate-700 mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-slate-700/30 last:border-0">
          <div className="h-4 w-20 rounded bg-slate-700" />
          <div className="h-4 w-16 rounded bg-slate-700" />
          <div className="h-4 w-24 rounded bg-slate-700" />
          <div className="h-4 flex-1 rounded bg-slate-700" />
        </div>
      ))}
    </div>
  );
}