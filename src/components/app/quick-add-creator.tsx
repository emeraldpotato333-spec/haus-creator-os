"use client";

import { type FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { defaultBossApprovalNeeded, getSuggestedExactStepForTier, getSuggestedNextAction, TIER_CONFIG } from "@/lib/creator-command-center";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function QuickAddCreator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tier, setTier] = useState<keyof typeof TIER_CONFIG | "">("");
  const [nextAction, setNextAction] = useState("");
  const [bossApprovalNeeded, setBossApprovalNeeded] = useState<"" | "true" | "false">("");
  const formRef = useRef<HTMLFormElement>(null);

  async function submitCreator(formData: FormData) {
    const payload = {
      name: getRequiredString(formData, "name"),
      handle: getRequiredString(formData, "handle"),
      platform: getOptionalString(formData, "platform") || "Instagram",
      nextAction: getNullableString(formData, "nextAction"),
      projectType: getNullableString(formData, "projectType"),
      tier: getNullableString(formData, "tier"),
      exactStep: getNullableString(formData, "exactStep"),
      collabAngle: getNullableString(formData, "collabAngle"),
      bossApprovalNeeded: getNullableBoolean(formData, "bossApprovalNeeded"),
      whyFit: getNullableString(formData, "collabAngle"),
      notes: getOptionalString(formData, "notes"),
      source: getNullableString(formData, "source"),
      niche: getNullableString(formData, "projectType"),
      contentQuality: getScore(formData, "contentQuality"),
      visualFitScore: getScore(formData, "visualFitScore"),
      commercialFitScore: getScore(formData, "commercialFitScore"),
      trustPurchaseIntentScore: getScore(formData, "brandFit"),
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
    setTier("");
    setNextAction("");
    setBossApprovalNeeded("");
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

  function handleTierChange(value: "" | keyof typeof TIER_CONFIG | null) {
    if (!value) {
      setTier("");
      return;
    }

    const nextTier = value as keyof typeof TIER_CONFIG;
    setTier(nextTier);
    setNextAction((current) => current || getSuggestedNextAction(nextTier));
    setBossApprovalNeeded((current) => {
      if (current) {
        return current;
      }

      return defaultBossApprovalNeeded(nextTier) ? "true" : "false";
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSubmitError(null);
          return;
        }

        setTier("");
        setNextAction("");
        setBossApprovalNeeded("");
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus />
        Quick classify
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Quick Classify</DialogTitle>
          <DialogDescription>
            Add the lead, decide the tier, and leave with one clear next action.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-5 px-6 py-5">
          <input type="hidden" name="exactStep" value={tier ? getSuggestedExactStepForTier(tier) ?? "" : ""} readOnly />
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
              <Label>Source</Label>
              <Input name="source" placeholder="Saved post, showroom referral, DM" />
            </label>
            <label className="grid gap-2">
              <Label>Project type</Label>
              <Input name="projectType" placeholder="Kitchen, bath, fireplace, UGC set" />
            </label>
            <label className="grid gap-2">
              <Label>Tier</Label>
              <Select name="tier" value={tier} onValueChange={handleTierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tier" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIER_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <Label>Boss approval needed?</Label>
              <Select name="bossApprovalNeeded" value={bossApprovalNeeded} onValueChange={(value) => setBossApprovalNeeded(value as typeof bossApprovalNeeded)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <Label>Next action</Label>
              <Input
                name="nextAction"
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Prepare boss approval packet"
              />
            </label>
          </div>
          <label className="grid gap-2">
            <Label>Collab angle</Label>
            <Textarea
              name="collabAngle"
              className="min-h-24"
              placeholder="Warm limestone bath project, believable install story, strong before/after potential."
            />
          </label>
          <div className="grid grid-cols-4 gap-4">
            <label className="grid gap-2">
              <Label>Fit score</Label>
              <Input name="visualFitScore" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Audience size</Label>
              <Input name="commercialFitScore" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Content quality</Label>
              <Input name="contentQuality" type="number" min={0} max={10} defaultValue={0} />
            </label>
            <label className="grid gap-2">
              <Label>Brand fit</Label>
              <Input name="brandFit" type="number" min={0} max={10} defaultValue={0} />
            </label>
          </div>
          <label className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              name="notes"
              className="min-h-28"
              placeholder="Anything helpful. Keep it light. The goal is one clear next move."
            />
          </label>
          <label className="grid gap-2">
            <Label>Tags</Label>
            <Input name="tags" placeholder="kitchen, anchor, ugc, nurture" />
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

function getNullableBoolean(formData: FormData, key: string) {
  const value = getFormString(formData, key);
  if (!value) {
    return null;
  }

  return value === "true";
}

function getTags(formData: FormData) {
  return getFormString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
