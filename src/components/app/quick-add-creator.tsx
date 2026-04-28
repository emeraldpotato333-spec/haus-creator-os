"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submitCreator(formData: FormData) {
    const payload = {
      name: getRequiredString(formData, "name"),
      handle: getRequiredString(formData, "handle"),
      platform: getOptionalString(formData, "platform") || "Instagram",
      profileUrl: getNullableString(formData, "profileUrl"),
      profileImageUrl: getNullableString(formData, "profileImageUrl"),
      niche: getNullableString(formData, "niche"),
      source: getNullableString(formData, "source"),
      audienceSummary: getNullableString(formData, "audienceSummary"),
      nextAction: getNullableString(formData, "nextAction"),
      visualFitScore: getScore(formData, "visualFitScore"),
      commercialFitScore: getScore(formData, "commercialFitScore"),
      contentQuality: getScore(formData, "contentQuality"),
      trustPurchaseIntentScore: getScore(formData, "trustPurchaseIntentScore"),
      whyFit: getNullableString(formData, "notes"),
      notes: getOptionalString(formData, "notes"),
      tags: getTags(formData),
    };

    console.info("[HAUS Creator OS] Quick Add submit", {
      name: payload.name,
      handle: payload.handle,
      platform: payload.platform,
      tagsCount: payload.tags.length,
    });

    const response = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const message = result?.error ?? "Creator could not be added.";
      console.error("[HAUS Creator OS] Quick Add failed", {
        status: response.status,
        message,
        result,
      });
      setSubmitError(message);
      toast.error(message);
      return;
    }

    console.info("[HAUS Creator OS] Quick Add success", result);
    setSubmitError(null);
    formRef.current?.reset();
    setOpen(false);
    toast.success(`Creator added${result?.name ? `: ${result.name}` : "."}`);
    router.refresh();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSubmitError(null);

    startTransition(() => {
      void submitCreator(formData);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSubmitError(null);
        }
      }}
    >
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
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5 px-6 py-5">
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add creator"}
            </Button>
          </div>
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getRequiredString(formData: FormData, key: string) {
  return getFormString(formData, key);
}

function getOptionalString(formData: FormData, key: string) {
  return getFormString(formData, key);
}

function getNullableString(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  return value || null;
}

function getScore(formData: FormData, key: string) {
  const raw = getFormString(formData, key);
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(10, parsed));
}

function getTags(formData: FormData) {
  return getFormString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
