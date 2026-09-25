import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SCORING_RULES, estimatedThroughput, formatTime } from "@/lib/wifi";
import { cveLookup, fetchDashboard, fetchSignalHistory } from "@/lib/wifi.functions";

const analyticsQuery = queryOptions({
  queryKey: ["analytics"],
  queryFn: async () => {
    const [dashboard, history] = await Promise.all([fetchDashboard(), fetchSignalHistory()]);
    return { dashboard, history };
  },
});

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — WiFiShield" },
      {
        name: "description",
        content:
          "Channel congestion, throughput estimates, signal trends and CVE lookups for nearby routers.",
      },
      { property: "og:title", content: "Analytics — WiFiShield" },
      {
        property: "og:description",
        content:
          "Channel congestion, throughput estimates, signal trends and CVE lookups for nearby routers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(analyticsQuery),
  component: Analytics,
});

const AXIS = { stroke: "oklch(0.68 0.02 250)", fontSize: 11 };

function Analytics() {
  const { data } = useSuspenseQuery(analyticsQuery);
  const networks = data.dashboard.networks;

  const channelData = useMemo(() => {
    const map = new Map<number, { channel: number; count: number; throughput: number }>();
    for (const n of networks) {
      const entry = map.get(n.channel) ?? { channel: n.channel, count: 0, throughput: 0 };
      entry.count += 1;
      entry.throughput = Math.max(entry.throughput, estimatedThroughput(n.signal_dbm, n.channel));
      map.set(n.channel, entry);
    }
    return [...map.values()].sort((a, b) => a.channel - b.channel);
  }, [networks]);

  const trend = data.dashboard.history.map((s) => ({
    time: formatTime(s.created_at).split(", ")[1] ?? "",
    score: s.avg_score,
    critical: s.critical_count,
  }));

  const ssids = useMemo(() => [...new Set(data.history.map((h) => h.ssid))].sort(), [data.history]);
  const [selected, setSelected] = useState<string>("");
  const active = selected || ssids[0] || "";
  const signalSeries = data.history
    .filter((h) => h.ssid === active)
    .map((h) => ({ t: formatTime(h.created_at).split(", ")[1] ?? "", dbm: h.signal_dbm }));

  return (
    <Shell>
      <p className="label-mono">Trends & spectrum</p>
      <h1 className="mt-1 text-3xl font-semibold">Analytics</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Channel congestion</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Access points per channel in the latest sweep. Overlapping 2.4 GHz channels are the
            usual cause of throughput collapse.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.31 0.024 252)" vertical={false} />
                <XAxis dataKey="channel" {...AXIS} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.02 250)",
                    border: "1px solid oklch(0.31 0.024 252)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="oklch(0.79 0.16 164)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Average score over time</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Security score across your recent sweeps.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.31 0.024 252)" vertical={false} />
                <XAxis dataKey="time" {...AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.02 250)",
                    border: "1px solid oklch(0.31 0.024 252)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="oklch(0.72 0.15 220)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Signal history</h2>
            <select
              value={active}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md border border-input bg-secondary px-2 py-1 font-mono text-xs"
            >
              {ssids.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Signal strength for one SSID across scans — useful for spotting intermittent APs.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signalSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.31 0.024 252)" vertical={false} />
                <XAxis dataKey="t" {...AXIS} tickLine={false} axisLine={false} />
                <YAxis domain={[-95, -25]} {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.02 250)",
                    border: "1px solid oklch(0.31 0.024 252)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="dbm" stroke="oklch(0.82 0.15 82)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <CveLookup />
      </div>

      <section className="panel mt-4 p-4">
        <h2 className="text-sm font-semibold">How the security score works</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every network starts at 100. Deductions stack. Below 40 is critical, 40–69 warning, 70+
          safe.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {SCORING_RULES.map((rule) => (
            <li key={rule.label} className="rounded-lg border border-border/70 bg-secondary/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{rule.label}</span>
                <span className="font-mono text-sm text-crit">−{rule.deduction}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{rule.why}</p>
            </li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

function CveLookup() {
  const [vendor, setVendor] = useState("TP-Link");
  const lookup = useServerFn(cveLookup);
  const mutation = useMutation({ mutationFn: (v: string) => lookup({ data: { vendor: v } }) });

  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold">CVE lookup</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Keyword search against the NIST National Vulnerability Database by router vendor. Results
        need manual triage — they are not firmware-version specific.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(vendor);
        }}
      >
        <Input
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor, e.g. Netgear"
          className="font-mono"
        />
        <Button type="submit" disabled={mutation.isPending}>
          <Search className="size-4" />
          {mutation.isPending ? "Searching…" : "Search"}
        </Button>
      </form>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {mutation.data?.error ? (
          <p className="text-xs text-warn">{mutation.data.error}</p>
        ) : null}
        {mutation.data?.results.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/70 bg-secondary/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-primary">{r.id}</span>
              {r.score !== null ? (
                <span className="font-mono text-xs text-warn">
                  CVSS {r.score} {r.severity ?? ""}
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{r.summary}</p>
          </div>
        ))}
        {mutation.data && mutation.data.results.length === 0 && !mutation.data.error ? (
          <p className="text-xs text-muted-foreground">No published CVEs matched that vendor.</p>
        ) : null}
      </div>
    </section>
  );
}
