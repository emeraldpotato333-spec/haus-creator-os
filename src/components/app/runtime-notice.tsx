import { AlertCircle } from "lucide-react";

export function RuntimeNotice({ notices }: { notices: string[] }) {
  const items = Array.from(new Set(notices.filter(Boolean)));

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-md border border-amber-300/60 bg-amber-100/80 p-4 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="grid gap-1">
          {items.map((notice) => (
            <div key={notice}>{notice}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
