import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Failed to load data",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-10 w-10 text-status-danger" />
      <p className="mt-3 text-sm text-content-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 rounded-lg bg-brand-accent/10 px-4 py-2 text-sm text-brand-accent hover:bg-brand-accent/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}