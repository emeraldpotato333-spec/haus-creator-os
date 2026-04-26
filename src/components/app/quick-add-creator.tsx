"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function QuickAddCreator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    startTransition(async () => {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          handle: formData.get("handle"),
          platform: formData.get("platform") || "Instagram",
          profileUrl: formData.get("profileUrl"),
          profileImageUrl: formData.get("profileImageUrl"),
          niche: formData.get("niche"),
          source: formData.get("source"),
          audienceSummary: formData.get("audienceSummary"),
          nextAction: formData.get("nextAction"),
          visualFitScore: Number(formData.get("visualFitScore") || 0),
          commercialFitScore: Number(formData.get("commercialFitScore") || 0),
          contentQuality: Number(formData.get("contentQuality") || 0),
          trustPurchaseIntentScore: Number(formData.get("trustPurchaseIntentScore") || 0),
          whyFit: formData.get("notes"),
          notes: formData.get("notes"),
          tags,
        }),
      });

      if (!response.ok) {
        toast.error("Creator could not be added.");
        return;
      }

      const creator = await response.json();
      toast.success("Creator added.");
      setOpen(false);
      router.refresh();
      router.push(`/creators/${creator.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Quick add
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Quick Add Creator</DialogTitle>
          <DialogDescription>
            Capture the signal now. You can refine scores, tasks, and templates later.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2">
              <Label>Name</Label>
              <Input name="name" required autoFocus placeholder="Mara Vale" />
            </label>
            <label className="grid gap-2">
              <Label>Handle</Label>
              <Input name="handle" required placeholder="@maravalehome" />
            </label>
            <label className="grid gap-2">
              <Label>Platform</Label>
              <Input name="platform" placeholder="Instagram" />
            </label>
            <label className="grid gap-2">
              <Label>Profile URL</Label>
              <Input name="profileUrl" placeholder="https://instagram.com/..." />
            </label>
            <label className="grid gap-2">
              <Label>Profile image URL</Label>
              <Input name="profileImageUrl" placeholder="https://..." />
            </label>
            <label className="grid gap-2">
              <Label>Niche</Label>
              <Input name="niche" placeholder="collected coastal interiors" />
            </label>
            <label className="grid gap-2">
              <Label>Source</Label>
              <Input name="source" placeholder="Instagram save folder" />
            </label>
            <label className="grid gap-2">
              <Label>Next action</Label>
              <Input name="nextAction" placeholder="Send tailored outreach" />
            </label>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <label className="grid gap-2">
              <Label>Visual fit</Label>
              <Input name="visualFitScore" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Commercial fit</Label>
              <Input name="commercialFitScore" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Content quality</Label>
              <Input name="contentQuality" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Trust / intent</Label>
              <Input name="trustPurchaseIntentScore" type="number" min={0} max={10} defaultValue={0} />
            </label>
          </div>
          <label className="grid gap-2">
            <Label>Audience notes</Label>
            <Textarea
              name="audienceSummary"
              className="min-h-28"
              placeholder="Premium homeowners, remodelers, and design-curious buyers."
            />
          </label>
          <label className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              name="notes"
              className="min-h-28"
              placeholder="Why the fit is interesting, objections, context, or angle."
            />
          </label>
          <label className="grid gap-2">
            <Label>Tags</Label>
            <Input name="tags" placeholder="designer, warm-minimal, high-fit" />
          </label>
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isPending}>{isPending ? "Adding..." : "Add creator"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
