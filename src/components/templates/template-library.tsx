"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TemplateRecord = {
  id: string;
  name: string;
  category: "OUTREACH" | "FOLLOW_UP" | "BRIEF" | "OFFER" | "RIGHTS" | "NURTURE";
  subject?: string | null;
  body: string;
  notes: string;
  variables: string[];
  isStarter: boolean;
};

const categories: TemplateRecord["category"][] = ["OUTREACH", "FOLLOW_UP", "BRIEF", "OFFER", "RIGHTS", "NURTURE"];
const templateGroups: Record<string, { eyebrow: string; note: string }> = {
  "Tier 1 Boss Approval Packet": {
    eyebrow: "Approve",
    note: "Use when the creator is strong enough that product support needs a real internal decision.",
  },
  "Tier 2 Personalized Collab Email": {
    eyebrow: "Offer",
    note: "Personal, warm, and specific. Keep the ask light.",
  },
  "Tier 3 UGC Paid Ads Inquiry": {
    eyebrow: "Offer",
    note: "Lead with paid ad asset clarity rather than organic reach.",
  },
  "Brief After Yes": {
    eyebrow: "Brief",
    note: "Do not brief before yes. Surface this only after there is real commitment.",
  },
};

export function TemplateLibrary({ templates }: { templates: TemplateRecord[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, TemplateRecord>>(Object.fromEntries(templates.map((item) => [item.id, item])));
  const [isPending, startTransition] = useTransition();
  const selected = drafts[selectedId] ?? templates[0];
  const orderedTemplates = templates
    .slice()
    .sort((left, right) => {
      const leftRank = Object.keys(templateGroups).indexOf(left.name);
      const rightRank = Object.keys(templateGroups).indexOf(right.name);

      if (leftRank === -1 && rightRank === -1) return left.name.localeCompare(right.name);
      if (leftRank === -1) return 1;
      if (rightRank === -1) return -1;
      return leftRank - rightRank;
    });

  function update<K extends keyof TemplateRecord>(key: K, value: TemplateRecord[K]) {
    setDrafts((current) => ({
      ...current,
      [selected.id]: { ...current[selected.id], [key]: value },
    }));
  }

  function save() {
    startTransition(async () => {
      const response = await fetch(`/api/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });

      if (response.ok) {
        toast.success("Template saved.");
        router.refresh();
      }
    });
  }

  function createTemplate() {
    startTransition(async () => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `New HAUS Template ${Date.now()}`,
          category: "OUTREACH",
          subject: "",
          body: "Write the template body here.",
          notes: "",
          variables: [],
        }),
      });
      if (response.ok) {
        toast.success("Template created.");
        router.refresh();
      }
    });
  }

  const selectedGuide = selected ? templateGroups[selected.name] : null;

  if (!selected) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No templates yet.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="grid h-fit gap-2">
        <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
          Keep templates lightweight. Do not overwork the system before the creator says yes.
        </div>
        <Button variant="outline" onClick={createTemplate} disabled={isPending}>
          <Plus />
          New template
        </Button>
        {orderedTemplates.map((template) => {
          const guide = templateGroups[template.name];

          return (
          <button
            key={template.id}
            onClick={() => setSelectedId(template.id)}
            className={`rounded-md border p-4 text-left transition-colors hover:bg-accent/35 ${selectedId === template.id ? "bg-accent/45" : "bg-card"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{template.name}</div>
              {template.isStarter ? <Badge variant="secondary">Starter</Badge> : null}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {guide?.eyebrow ?? template.category.replace("_", " ")}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{guide?.note ?? "Reusable working language."}</div>
          </button>
          );
        })}
      </div>

      <Card className="haus-panel">
        <CardContent className="grid gap-4 p-5">
          {selectedGuide ? (
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              {selectedGuide.note}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Input value={selected.name} onChange={(event) => update("name", event.target.value)} className="h-11 text-xl font-semibold" />
          </div>
          <div className="grid grid-cols-[220px_1fr] gap-3">
            <Select value={selected.category} onValueChange={(value) => value && update("category", value as TemplateRecord["category"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>{category.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={selected.subject ?? ""} onChange={(event) => update("subject", event.target.value)} placeholder="Subject line" />
          </div>
          <Textarea value={selected.body} onChange={(event) => update("body", event.target.value)} className="min-h-[480px] font-mono text-sm leading-6" />
          <Input
            value={selected.variables.join(", ")}
            onChange={(event) => update("variables", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
            placeholder="creator_name, product_line"
          />
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(selected.body)}>
              <Copy />
              Copy body
            </Button>
            <Button onClick={save} disabled={isPending}>
              <Save />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
