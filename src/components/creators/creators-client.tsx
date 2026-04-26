"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/app/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CreatorAvatar,
  PriorityBadge,
  StageBadge,
} from "@/components/creators/creator-identity";
import { PIPELINE_STAGES } from "@/lib/domain";

type CreatorListItem = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  profileImageUrl?: string | null;
  niche?: string | null;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  priority: "LOW" | "MEDIUM" | "HIGH";
  tags: string[];
  nextAction?: string | null;
  overallScore: number;
  tasks: { id: string; title?: string; status: string }[];
};

export function CreatorsClient({ creators }: { creators: CreatorListItem[] }) {
  const [items, setItems] = useState(creators);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<CreatorListItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((creator) => {
      const matchesStage = stage === "ALL" || creator.stage === stage;
      const matchesQuery =
        !q ||
        [creator.name, creator.handle, creator.niche, creator.platform, creator.nextAction, ...creator.tags]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return matchesStage && matchesQuery;
    });
  }, [items, query, stage]);

  async function deleteCreator() {
    if (!deleteTarget) {
      return;
    }

    const response = await fetch(`/api/creators/${deleteTarget.id}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Creator could not be deleted.");
      return;
    }

    setItems((current) => current.filter((creator) => creator.id !== deleteTarget.id));
    toast.success("Creator deleted.");
  }

  async function loadDemoData() {
    const response = await fetch("/api/demo-data", { method: "POST" });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? "Demo data could not be loaded.");
      return;
    }

    window.location.reload();
  }

  async function importCsv(kind: "creators" | "tasks", file: File | undefined) {
    if (!file) {
      return;
    }

    const csv = await file.text();
    const response = await fetch("/api/import/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, csv }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      toast.error(result?.error ?? "CSV import failed.");
      return;
    }

    toast.success(kind === "creators" ? "Creators imported." : "Tasks imported.");
    window.location.reload();
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-5">
        <div className="rounded-md border border-dashed p-12 text-center">
          <div className="text-lg font-medium">No creators yet. Add your first creator.</div>
          <div className="mt-2 text-sm text-muted-foreground">Start with one strong fit and build the desk from real activity.</div>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={loadDemoData} variant="outline">
              Load demo data
            </Button>
            <Button variant="outline" render={<a href="/api/export?type=creators-csv" />}>
              <Download />
              CSV format
            </Button>
          </div>
          <div className="mx-auto mt-4 max-w-sm text-left text-sm text-muted-foreground">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Upload className="size-4" />
                Import creators CSV
              </span>
              <Input type="file" accept=".csv,text/csv" onChange={(event) => importCsv("creators", event.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-80 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="haus-input pl-9"
            placeholder="Search name, handle, niche, tag..."
          />
        </div>
        <Select value={stage} onValueChange={(value) => value && setStage(value)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All stages</SelectItem>
            {PIPELINE_STAGES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" render={<a href="/api/export?type=creators-csv" />}>
          <Download />
          Export CSV
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent/30">
          <Upload className="size-4" />
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => importCsv("creators", event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="grid gap-3">
        {filtered.map((creator) => {
          const nextAction = creator.nextAction || creator.tasks.find((task) => task.status !== "DONE")?.title || "Set the next action";

          return (
            <Card key={creator.id} className="haus-panel transition-colors hover:bg-accent/20 hover:shadow-md">
              <CardContent className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <Link href={`/creators/${creator.id}`} className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <CreatorAvatar creator={creator} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium">{creator.name}</div>
                        <span className="text-sm text-muted-foreground">
                          {creator.handle} / {creator.platform}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StageBadge stage={creator.stage} />
                        <PriorityBadge priority={creator.priority} />
                        {creator.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="bg-muted text-foreground">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1 pl-[3.25rem]">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Next action
                    </div>
                    <p className="line-clamp-1 text-sm">{nextAction}</p>
                  </div>
                </Link>

                <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                  <div className="text-right">
                    <div className="font-mono text-2xl">{creator.overallScore.toFixed(1)}</div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">fit score</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${creator.name}`}
                    onClick={() => setDeleteTarget(creator)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No creators match that view.
        </div>
      ) : null}

      <ConfirmActionDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "creator"}?`}
        description="This removes the creator and related tasks from the workspace."
        confirmLabel="Delete creator"
        onConfirm={deleteCreator}
      />
    </div>
  );
}
