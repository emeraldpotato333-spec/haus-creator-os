"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatorIdentity, CreatorMetaBadges, creatorFitLine } from "@/components/creators/creator-identity";
import { PIPELINE_STAGES } from "@/lib/domain";

type CreatorListItem = {
  id: string;
  name: string;
  handle: string;
  platform: string;
  niche?: string | null;
  stage: (typeof PIPELINE_STAGES)[number]["value"];
  priority: "LOW" | "MEDIUM" | "HIGH";
  tags: string[];
  audienceSummary?: string | null;
  whyFit?: string | null;
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
            <Card className="haus-panel transition-colors hover:bg-accent/25 hover:ring-foreground/20">
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <CreatorIdentity creator={creator} />
                <div className="min-w-0">
                  <CreatorMetaBadges creator={creator} />
                  <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                    {creatorFitLine(creator)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 lg:justify-end">
                  <div className="hidden flex-wrap gap-1 xl:flex">
                  {creator.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl">{creator.overallScore.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">overall</div>
                  </div>
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
