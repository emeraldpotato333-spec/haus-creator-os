"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  id: string;
  brandName: string;
  defaultTheme: string;
  memoryText: string;
  brandVoice: string;
  recruitmentCriteria: string;
};

export function SettingsEditor({
  initialSettings,
  mode = "settings",
}: {
  initialSettings: Settings;
  mode?: "settings" | "notes";
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("saved");
  const [isPending, startTransition] = useTransition();
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) {
      return;
    }

    setStatus("saving");
    const timeout = window.setTimeout(async () => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      setStatus(response.ok ? "saved" : "error");
      dirtyRef.current = !response.ok;
    }, 550);

    return () => window.clearTimeout(timeout);
  }, [settings]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    dirtyRef.current = true;
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function importJson(file: File | undefined) {
    if (!file) {
      return;
    }

    startTransition(async () => {
      const text = await file.text();
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      if (response.ok) {
        toast.success("Import complete.");
        router.refresh();
      } else {
        toast.error("Import failed.");
      }
    });
  }

  if (mode === "notes") {
    return (
      <Card className="haus-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Operating memory</CardTitle>
          <span className="text-xs text-muted-foreground">{status}</span>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            value={settings.memoryText}
            onChange={(event) => update("memoryText", event.target.value)}
            className="min-h-[560px] text-base leading-7"
            placeholder="Store creator principles, positioning notes, offer logic, exclusions, and ideas you want HAUS Creator OS to remember."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="haus-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>App settings</CardTitle>
          <span className="text-xs text-muted-foreground">{status}</span>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2">
            <Label>Brand name</Label>
            <Input value={settings.brandName} onChange={(event) => update("brandName", event.target.value)} />
          </label>
          <label className="grid gap-2">
            <Label>Default theme</Label>
            <Select value={settings.defaultTheme} onValueChange={(value) => value && update("defaultTheme", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2">
            <Label>Brand voice</Label>
            <Textarea value={settings.brandVoice} onChange={(event) => update("brandVoice", event.target.value)} className="min-h-36" />
          </label>
          <label className="grid gap-2">
            <Label>Recruitment criteria</Label>
            <Textarea value={settings.recruitmentCriteria} onChange={(event) => update("recruitmentCriteria", event.target.value)} className="min-h-36" />
          </label>
        </CardContent>
      </Card>

      <Card className="haus-panel h-fit">
        <CardHeader><CardTitle>Data portability</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Button variant="outline" render={<a href="/api/export?type=json" />}>
            <Download />
            Export JSON
          </Button>
          <Button variant="outline" render={<a href="/api/export?type=creators-csv" />}>
            <Download />
            Export creators CSV
          </Button>
          <Button variant="outline" render={<a href="/api/export?type=tasks-csv" />}>
            <Download />
            Export tasks CSV
          </Button>
          <label className="grid gap-2 rounded-md border border-dashed p-4 text-sm">
            <span className="flex items-center gap-2 font-medium"><Upload className="size-4" /> Import JSON</span>
            <Input type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} disabled={isPending} />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
