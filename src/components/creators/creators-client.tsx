"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PIPELINE_STAGES, stageLabel } from "@/lib/domain";

type CreatorListItem = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  niche?: string | null;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  tags: string[];
  followers?: number | null;
  overallScore: number;
  updatedAt: string | Date;
  tasks: { id: string; status: string }[];
  briefs: { id: string }[];
};

export function CreatorsClient({ creators }: { creators: CreatorListItem[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("ALL");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return creators.filter((creator) => {
      const matchesStage = stage === "ALL" || creator.stage === stage;
      const matchesQuery =
        !q ||
        [creator.name, creator.handle, creator.niche, creator.platform, ...creator.tags]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return matchesStage && matchesQuery;
    });
  }, [creators, query, stage]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="relative min-w-80">
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
        <Button variant="outline" className="ml-auto" render={<a href="/api/export?type=creators-csv" />}>
          <Download />
          Creators CSV
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.map((creator) => (
          <Link key={creator.id} href={`/creators/${creator.id}`}>
            <Card className="haus-panel transition-colors hover:bg-accent/30">
              <CardContent className="grid grid-cols-[1.1fr_0.8fr_0.6fr_0.5fr] items-center gap-5 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{creator.name}</div>
                    <Badge variant="outline">{creator.platform}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {creator.handle} {creator.niche ? `· ${creator.niche}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {creator.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Stage</div>
                  <div className="mt-1 font-medium">{stageLabel(creator.stage)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl">{creator.overallScore.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">overall</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No creators match that view. Try a softer filter or quick-add a new lead.
        </div>
      ) : null}
    </div>
  );
}
