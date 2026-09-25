import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Assistant } from "@/components/Assistant";
import { NetworkTable, StatCard } from "@/components/network-ui";
import { ScanActions } from "@/components/ScanActions";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { fetchDashboard, runScan } from "@/lib/wifi.functions";
import { formatTime } from "@/lib/wifi";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => fetchDashboard(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WiFiShield — Wireless Network Security Analyzer" },
      {
        name: "description",
        content:
          "Scan nearby Wi-Fi networks, score their security, and catch rogue access points with evil-twin detection.",
      },
      { property: "og:title", content: "WiFiShield — Wireless Network Security Analyzer" },
      {
        property: "og:description",
        content:
          "Scan nearby Wi-Fi networks, score their security, and catch rogue access points with evil-twin detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

const SOURCE_LABEL: Record<string, string> = {
  live: "this device's connection",
  imported: "imported real scan",
  simulator: "demo data",
};

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const queryClient = useQueryClient();
  const scan = useServerFn(runScan);
  const [autoScan, setAutoScan] = useState(false);

  const mutation = useMutation({
    mutationFn: () => scan(),
    onSuccess: (result) => {
      toast.success(`Scan complete — ${result.network_count} networks found`, {
        description: `${result.critical_count} critical · ${result.warning_count} warning · ${result.safe_count} safe`,
      });
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error("Scan failed", { description: error.message }),
  });

  const trigger = mutation.mutate;
  useEffect(() => {
    if (!autoScan) return;
    const id = setInterval(() => trigger(), 60_000);
    return () => clearInterval(id);
  }, [autoScan, trigger]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wifishield-scan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const evilTwins = data.networks.filter((n) => n.evil_twin);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Live surface</p>
          <h1 className="mt-1 text-3xl font-semibold">Airspace overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.latest
              ? `Last scan ${formatTime(data.latest.created_at)} · ${SOURCE_LABEL[data.latest.source] ?? data.latest.source}`
              : "No scans yet — run your first sweep."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportJson} disabled={!data.latest}>
            <Download className="size-4" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <ScanActions />
      </div>


      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Networks in range"
          value={data.latest?.network_count ?? 0}
          hint="Access points detected in the latest sweep"
        />
        <StatCard
          label="Average score"
          value={data.latest?.avg_score ?? 0}
          hint="0–100 across all detected networks"
          tone={
            (data.latest?.avg_score ?? 0) < 40
              ? "crit"
              : (data.latest?.avg_score ?? 0) < 70
                ? "warn"
                : "safe"
          }
        />
        <StatCard
          label="Critical"
          value={data.latest?.critical_count ?? 0}
          hint="Score below 40"
          tone="crit"
        />
        <StatCard
          label="Rogue AP flags"
          value={evilTwins.length}
          hint="Duplicate SSID on an untrusted MAC"
          tone={evilTwins.length ? "warn" : "safe"}
        />
      </div>

      {evilTwins.length > 0 ? (
        <div className="panel mt-6 border-crit/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-crit" />
            <div>
              <p className="font-medium text-crit">Possible evil twin detected</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {evilTwins.map((n) => n.ssid).join(", ")} — the same network name is broadcasting
                from more than one hardware address. Add the legitimate router to the{" "}
                <Link to="/trusted" className="text-primary underline underline-offset-4">
                  whitelist
                </Link>{" "}
                to silence false positives from mesh setups.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Detected access points</h2>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoScan}
            onChange={(e) => {
              setAutoScan(e.target.checked);
              toast.info(
                e.target.checked
                  ? "Auto-scan armed — a sweep will run every 60 seconds while this tab is open"
                  : "Auto-scan disabled",
              );
            }}
            className="size-3.5 accent-[oklch(0.79_0.16_164)]"
          />
          Auto-scan every 60s
        </label>
      </div>
      <div className="mt-3">
        <NetworkTable networks={data.networks} />
      </div>
      <Assistant />
    </Shell>
  );
}
