import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";

import { NetworkTable, StatCard } from "@/components/network-ui";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { fetchScanDetail } from "@/lib/wifi.functions";
import { formatTime } from "@/lib/wifi";

const detailQuery = (scanId: string) =>
  queryOptions({
    queryKey: ["scan", scanId],
    queryFn: () => fetchScanDetail({ data: { scanId } }),
  });

export const Route = createFileRoute("/scans/$scanId")({
  head: () => ({
    meta: [
      { title: "Scan Detail — WiFiShield" },
      {
        name: "description",
        content: "Full breakdown of one Wi-Fi sweep: every access point, its score, and its risks.",
      },
      { property: "og:title", content: "Scan Detail — WiFiShield" },
      {
        property: "og:description",
        content: "Full breakdown of one Wi-Fi sweep: every access point, its score, and its risks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(detailQuery(params.scanId));
    if (!data.scan) throw notFound();
    return data;
  },
  component: ScanDetail,
  errorComponent: () => (
    <Shell>
      <p className="panel p-8 text-center text-sm text-muted-foreground">
        This scan could not be loaded.
      </p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="panel p-8 text-center text-sm text-muted-foreground">Scan not found.</p>
    </Shell>
  ),
});

function ScanDetail() {
  const { scanId } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(scanId));
  const scan = data.scan!;

  return (
    <Shell>
      <Link
        to="/scans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to history
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Sweep report</p>
          <h1 className="mt-1 text-3xl font-semibold">{formatTime(scan.created_at)}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> Print / PDF
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Networks" value={scan.network_count} />
        <StatCard label="Average score" value={scan.avg_score} />
        <StatCard label="Critical" value={scan.critical_count} tone="crit" />
        <StatCard label="Safe" value={scan.safe_count} tone="safe" />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Access points</h2>
      <div className="mt-3">
        <NetworkTable networks={data.networks} />
      </div>
    </Shell>
  );
}
