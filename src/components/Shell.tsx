import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/live", label: "Live scan" },
  { to: "/scans", label: "Scan history" },
  { to: "/analytics", label: "Analytics" },
  { to: "/trusted", label: "Whitelist" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md bg-primary/15 text-primary radar-pulse">
              <ShieldCheck className="size-4.5" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              WiFi<span className="text-primary">Shield</span>
            </span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link to="/live" className="label-mono hidden rounded-md border border-primary/40 px-2 py-1 text-primary hover:bg-primary/10 sm:inline">Live + imported scans</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        <p className="label-mono">
          WiFiShield · wireless security analyzer · live check, imported scans and demo data
        </p>
      </footer>
    </div>
  );
}
