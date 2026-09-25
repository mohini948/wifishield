import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { fetchScans, removeScan } from "@/lib/wifi.functions";
import { formatTime } from "@/lib/wifi";

const scansQuery = queryOptions({ queryKey: ["scans"], queryFn: () => fetchScans() });

export const Route = createFileRoute("/scans")({
  head: () => ({
    meta: [
      { title: "Scan History — WiFiShield" },
      {
        name: "description",
        content: "Every Wi-Fi sweep WiFiShield has recorded, with score trends and risk breakdowns.",
      },
      { property: "og:title", content: "Scan History — WiFiShield" },
      {
        property: "og:description",
        content: "Every Wi-Fi sweep WiFiShield has recorded, with score trends and risk breakdowns.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(scansQuery),
  component: ScanHistory,
});

function ScanHistory() {
  const { data } = useSuspenseQuery(scansQuery);
  const queryClient = useQueryClient();
  const del = useServerFn(removeScan);
  const mutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Scan deleted");
      void queryClient.invalidateQueries();
    },
  });

  const exportCsv = () => {
    const header = "timestamp,networks,avg_score,critical,warning,safe";
    const rows = data.map(
      (s) =>
        `${s.created_at},${s.network_count},${s.avg_score},${s.critical_count},${s.warning_count},${s.safe_count}`,
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wifishield-scan-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">Persisted sweeps</p>
          <h1 className="mt-1 text-3xl font-semibold">Scan history</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.length === 0}>
          Export CSV
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
          No scans recorded yet. Run one from the dashboard.
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left">
                {["Timestamp", "Networks", "Avg score", "Critical", "Warning", "Safe", ""].map((h) => (
                  <th key={h} className="label-mono px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/scans/$scanId"
                      params={{ scanId: s.id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {formatTime(s.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{s.network_count}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{s.avg_score}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-crit">{s.critical_count}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-warn">{s.warning_count}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-safe">{s.safe_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => mutation.mutate(s.id)}
                      aria-label="Delete scan"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
