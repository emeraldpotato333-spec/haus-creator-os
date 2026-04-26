import {
  Camera,
  CircleDot,
  Gem,
  Globe2,
  Home,
  Layers3,
  MapPin,
  NotebookText,
  Palette,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { stageLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/generated/prisma/client";

type CreatorIdentityData = {
  name: string;
  handle: string;
  platform?: string | null;
  profileImageUrl?: string | null;
  niche?: string | null;
  tags?: string[];
  stage?: PipelineStage;
  priority?: "LOW" | "MEDIUM" | "HIGH" | string;
  overallScore?: number;
  nextAction?: string | null;
};

const stageStyles: Record<PipelineStage, string> = {
  SOURCED: "border-stone-300 bg-stone-100 text-stone-900 dark:border-stone-500/25 dark:bg-stone-500/10 dark:text-stone-100",
  VETTED: "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-400/25 dark:bg-zinc-400/10 dark:text-zinc-100",
  INVITED: "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100",
  REPLIED: "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-100",
  QUALIFIED: "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-100",
  SAMPLE_SENT: "border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-100",
  BRIEF_SENT: "border-indigo-300 bg-indigo-100 text-indigo-950 dark:border-indigo-400/25 dark:bg-indigo-400/10 dark:text-indigo-100",
  CONTENT_LIVE: "border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-100",
  EVALUATED: "border-cyan-300 bg-cyan-100 text-cyan-950 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-100",
  EXPANDED: "border-lime-300 bg-lime-100 text-lime-950 dark:border-lime-400/25 dark:bg-lime-400/10 dark:text-lime-100",
  AMBASSADOR: "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-300/15 dark:text-emerald-50",
};

const avatarTones = [
  "from-stone-200 to-stone-100 dark:from-stone-200/20 dark:to-stone-500/10",
  "from-emerald-200 to-cyan-100 dark:from-emerald-300/20 dark:to-cyan-500/10",
  "from-amber-200 to-rose-100 dark:from-amber-300/20 dark:to-rose-500/10",
  "from-sky-200 to-violet-100 dark:from-sky-300/20 dark:to-violet-500/10",
  "from-lime-200 to-teal-100 dark:from-lime-300/20 dark:to-teal-500/10",
  "from-fuchsia-200 to-indigo-100 dark:from-fuchsia-300/15 dark:to-indigo-500/10",
];

export function CreatorIdentity({
  creator,
  compact = false,
  className,
}: {
  creator: CreatorIdentityData;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <CreatorAvatar creator={creator} size={compact ? "sm" : "md"} />
      <div className="min-w-0">
        <div className={cn("truncate font-medium", compact ? "text-sm" : "text-base")}>{creator.name}</div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate">{creator.handle}</span>
          {creator.platform ? <PlatformLabel platform={creator.platform} /> : null}
          {creator.niche ? <span className="truncate">{creator.niche}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function CreatorAvatar({
  creator,
  size = "md",
}: {
  creator: Pick<CreatorIdentityData, "name" | "handle" | "profileImageUrl">;
  size?: "sm" | "md" | "lg";
}) {
  const tone = avatarTones[hashCreator(creator.name + creator.handle) % avatarTones.length];

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-border bg-gradient-to-br font-medium text-foreground shadow-sm dark:border-white/10 dark:text-stone-50",
        tone,
        size === "sm" && "size-8 text-xs",
        size === "md" && "size-10 text-sm",
        size === "lg" && "size-14 text-base",
      )}
      aria-hidden="true"
    >
      {creator.profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creator.profileImageUrl}
          alt={creator.name}
          className="size-full rounded-full object-cover"
        />
      ) : (
        getInitials(creator.name)
      )}
    </div>
  );
}

export function CreatorMetaBadges({ creator }: { creator: CreatorIdentityData }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {creator.stage ? <StageBadge stage={creator.stage} /> : null}
      {creator.priority ? <PriorityBadge priority={creator.priority} /> : null}
      <CreatorTypeBadge creator={creator} />
      {creator.overallScore !== undefined ? <ScorePill score={creator.overallScore} /> : null}
    </div>
  );
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <Badge variant="outline" className={cn("h-6 border", stageStyles[stage])}>
      <StageIcon stage={stage} />
      {stageLabel(stage)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toUpperCase();
  const className =
    normalized === "HIGH"
      ? "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
      : normalized === "LOW"
        ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200"
        : "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100";

  return (
    <Badge variant="outline" className={cn("h-6 border", className)}>
      <Star className="size-3" />
      {normalized === "HIGH" ? "High priority" : normalized === "LOW" ? "Low priority" : "Medium priority"}
    </Badge>
  );
}

export function CreatorTypeBadge({ creator }: { creator: Pick<CreatorIdentityData, "niche" | "tags"> }) {
  const type = inferCreatorType(creator);

  return (
    <Badge variant="outline" className="h-6 border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
      <CreatorTypeIcon label={type.label} />
      {type.label}
    </Badge>
  );
}

export function ScorePill({ score }: { score: number }) {
  const label = score >= 8 ? "High fit" : score >= 6 ? "Promising" : "Needs proof";
  const className =
    score >= 8
      ? "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100"
      : score >= 6
        ? "border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100"
        : "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200";

  return (
    <Badge variant="outline" className={cn("h-6 border font-mono", className)}>
      {score.toFixed(1)}
      <span className="font-sans">{label}</span>
    </Badge>
  );
}

export function PlatformLabel({ platform }: { platform: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 truncate">
      <PlatformIcon platform={platform} />
      {platform}
    </span>
  );
}

export function creatorFitLine(creator: Pick<CreatorIdentityData, "niche" | "tags" | "overallScore" | "nextAction"> & { whyFit?: string | null; audienceSummary?: string | null }) {
  if (creator.nextAction) {
    return creator.nextAction;
  }

  if (creator.whyFit) {
    return creator.whyFit;
  }

  if (creator.audienceSummary) {
    return creator.audienceSummary;
  }

  if (creator.niche) {
    return `${creator.niche} creator with ${creator.overallScore !== undefined && creator.overallScore >= 8 ? "strong" : "developing"} HAUS fit.`;
  }

  if (creator.tags?.length) {
    return creator.tags.slice(0, 3).join(", ");
  }

  return "Add a fit note so the next action is easier to judge.";
}

function StageIcon({ stage }: { stage: PipelineStage }) {
  if (stage === "CONTENT_LIVE") return <Video className="size-3" />;
  if (stage === "AMBASSADOR" || stage === "EXPANDED") return <Gem className="size-3" />;
  if (stage === "QUALIFIED" || stage === "EVALUATED") return <ShieldCheck className="size-3" />;
  if (stage === "INVITED" || stage === "REPLIED") return <Send className="size-3" />;
  if (stage === "BRIEF_SENT" || stage === "SAMPLE_SENT") return <NotebookText className="size-3" />;
  return <CircleDot className="size-3" />;
}

function PlatformIcon({ platform }: { platform: string }) {
  const value = platform.toLowerCase();

  if (value.includes("instagram")) return <Camera className="size-3 shrink-0" />;
  if (value.includes("youtube")) return <Play className="size-3 shrink-0" />;
  if (value.includes("tiktok")) return <Video className="size-3 shrink-0" />;
  if (value.includes("pinterest")) return <Camera className="size-3 shrink-0" />;

  return <Globe2 className="size-3 shrink-0" />;
}

function inferCreatorType(creator: Pick<CreatorIdentityData, "niche" | "tags">) {
  const text = `${creator.niche ?? ""} ${(creator.tags ?? []).join(" ")}`.toLowerCase();

  if (text.includes("design") || text.includes("interior")) return { label: "Designer" };
  if (text.includes("reno") || text.includes("build")) return { label: "Renovator" };
  if (text.includes("style") || text.includes("aesthetic")) return { label: "Stylist" };
  if (text.includes("local") || text.includes("location")) return { label: "Local fit" };
  if (text.includes("ugc") || text.includes("content")) return { label: "Content" };

  return { label: "Creator" };
}

function CreatorTypeIcon({ label }: { label: string }) {
  if (label === "Designer") return <Home className="size-3" />;
  if (label === "Renovator") return <Layers3 className="size-3" />;
  if (label === "Stylist") return <Palette className="size-3" />;
  if (label === "Local fit") return <MapPin className="size-3" />;
  if (label === "Content") return <Sparkles className="size-3" />;

  return <UserRound className="size-3" />;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function hashCreator(value: string) {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
