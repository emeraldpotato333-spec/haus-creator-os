"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LoadDemoButton({ variant = "outline" }: { variant?: "default" | "outline" | "secondary" | "ghost" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch("/api/demo-data", { method: "POST" });

          if (!response.ok) {
            const result = await response.json().catch(() => null);
            toast.error(result?.error ?? "Demo data could not be loaded.");
            return;
          }

          toast.success("Demo data loaded.");
          router.refresh();
        })
      }
    >
      {isPending ? "Loading..." : "Load demo data"}
    </Button>
  );
}
