"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LayoutDashboard, ListChecks, Search, Send, Settings, UserRound } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type SearchCreator = {
  id: string;
  name: string;
  handle: string;
  niche?: string | null;
};

const actions = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Creators", href: "/creators", icon: UserRound },
  { label: "Pipeline", href: "/pipeline", icon: Send },
  { label: "Tasks", href: "/tasks", icon: ListChecks },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Notes / Memory", href: "/notes", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function GlobalCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [creators, setCreators] = useState<SearchCreator[]>([]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    fetch("/api/creators")
      .then((response) => response.json())
      .then(setCreators)
      .catch(() => setCreators([]));
  }, [open]);

  const topCreators = useMemo(() => creators.slice(0, 8), [creators]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search HAUS Creator OS">
      <Command className="rounded-lg border-0">
        <CommandInput placeholder="Search creators or jump to a section..." />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Go to">
            {actions.map((action) => (
              <CommandItem key={action.href} onSelect={() => go(action.href)}>
                <action.icon />
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Creators">
            {topCreators.map((creator) => (
              <CommandItem key={creator.id} value={`${creator.name} ${creator.handle}`} onSelect={() => go(`/creators/${creator.id}`)}>
                <Search />
                <span>{creator.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{creator.handle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
