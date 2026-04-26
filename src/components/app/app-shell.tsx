"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  CommandIcon,
  FileText,
  LayoutDashboard,
  ListChecks,
  Menu,
  PanelsTopLeft,
  Send,
  Settings,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GlobalCommand } from "@/components/app/global-command";
import { QuickAddCreator } from "@/components/app/quick-add-creator";
import { ThemeToggle } from "@/components/app/theme-toggle";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/creators", label: "Creators", icon: UserRound },
  { href: "/pipeline", label: "Pipeline", icon: PanelsTopLeft },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/templates", label: "Templates", icon: Send },
  { href: "/notes", label: "Notes / Memory", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-sidebar/80 px-4 py-5 backdrop-blur md:flex md:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-md border bg-background">
            <Archive className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] uppercase">HAUS</div>
            <div className="text-xs text-muted-foreground">Creator OS</div>
          </div>
        </Link>
        <Separator className="my-5" />
        <nav className="grid gap-1">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-md border bg-background/55 p-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Operator mode
          </div>
          <p className="mt-2 text-sm leading-5">
            Text first. Low friction. Every creator should have a clear next action.
          </p>
        </div>
      </aside>

      <div className="md:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/82 px-5 backdrop-blur">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Open navigation" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-full flex-col bg-sidebar px-4 py-5">
                <Link href="/dashboard" className="flex items-center gap-3 px-2">
                  <div className="grid size-9 place-items-center rounded-md border bg-background">
                    <Archive className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-[0.18em] uppercase">HAUS</div>
                    <div className="text-xs text-muted-foreground">Creator OS</div>
                  </div>
                </Link>
                <Separator className="my-5" />
                <nav className="grid gap-1">
                  {nav.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          active && "bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            className="h-9 min-w-0 flex-1 justify-start gap-2 text-muted-foreground md:min-w-72 md:flex-none"
            onClick={() => setCommandOpen(true)}
          >
            <CommandIcon className="size-4" />
            Search or command
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <QuickAddCreator />
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1680px] px-6 py-6">
          {children}
        </main>
      </div>
      <GlobalCommand open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
