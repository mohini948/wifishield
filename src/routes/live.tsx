import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { NetworkTable, StatCard } from "@/components/network-ui";
import { ScanActions } from "@/components/ScanActions";
import { Shell } from "@/components/Shell";
import { fetchRealScans } from "@/lib/wifi.functions";
import { formatTime } from "@/lib/wifi";

const realQuery = queryOptions({ queryKey: ["real-scans"], queryFn: () => fetchRealScans() });

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live & Imported Scans — WiFiShield" },
      { name: "description", content: "Scan the real Wi-Fi networks around you and review live and imported results." },
      { property: "og:title", content: "Live & Imported Scans — WiFiShield" },
      { property: "og:description", content: "Scan the real Wi-Fi networks around you and review live and imported results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(realQuery),
  component: LivePage,
});

const LABEL: Record<string, string> = { live: "Your connection", imported: "Nearby networks scan" };

function LivePage() {
  const { data } = useSuspenseQuery(realQuery);
  const l = data.latest;
  return (
    <Shell>
      <p className="label-mono">Real-world data only</p>
      <h1 className="mt-1 text-3xl font-semibold">Live + imported scans</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {l
          ? `Latest real scan ${formatTime(l.created_at)} · ${LABEL[l.source] ?? l.source}`
          : "No real scans yet. Click “Scan nearby networks” or “Check my connection” below."}
      </p>
      <div className="mt-4">
        <ScanActions />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Networks" value={l?.network_count ?? 0} hint="In the latest real scan" />
        <StatCard label="Average score" value={l?.avg_score ?? 0} hint="0–100" />
        <StatCard label="Critical" value={l?.critical_count ?? 0} hint="Score below 40" tone="crit" />
        <StatCard label="Safe" value={l?.safe_count ?? 0} hint="Score 70+" tone="safe" />
      </div>
      <h2 className="mt-6 text-lg font-semibold">Networks found</h2>
      <div className="mt-3">
        <NetworkTable networks={data.networks} />
      </div>
      {data.scans.length > 1 ? (
        <>
          <h2 className="mt-6 text-lg font-semibold">Earlier real scans</h2>
          <ul className="mt-3 space-y-2">
            {data.scans.slice(1).map((s) => (
              <li key={s.id} className="panel flex justify-between p-3 text-sm">
                <Link to="/scans/$scanId" params={{ scanId: s.id }} className="text-primary underline">
                  {formatTime(s.created_at)} · {LABEL[s.source] ?? s.source}
                </Link>
                <span className="text-muted-foreground">
                  {s.network_count} networks · score {s.avg_score}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Shell>
  );
}
