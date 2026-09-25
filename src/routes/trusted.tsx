import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTrusted, deleteTrusted, fetchDashboard, fetchTrusted } from "@/lib/wifi.functions";
import { formatTime } from "@/lib/wifi";

const trustedQuery = queryOptions({
  queryKey: ["trusted"],
  queryFn: async () => {
    const [trusted, dashboard] = await Promise.all([fetchTrusted(), fetchDashboard()]);
    return { trusted, networks: dashboard.networks };
  },
});

export const Route = createFileRoute("/trusted")({
  head: () => ({
    meta: [
      { title: "Trusted Devices — WiFiShield" },
      {
        name: "description",
        content:
          "Whitelist your own router hardware addresses so imposters broadcasting the same network name get flagged.",
      },
      { property: "og:title", content: "Trusted Devices — WiFiShield" },
      {
        property: "og:description",
        content:
          "Whitelist your own router hardware addresses so imposters broadcasting the same network name get flagged.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(trustedQuery),
  component: Trusted,
});

function Trusted() {
  const { data } = useSuspenseQuery(trustedQuery);
  const queryClient = useQueryClient();
  const add = useServerFn(createTrusted);
  const del = useServerFn(deleteTrusted);
  const [form, setForm] = useState({ ssid: "", bssid: "", label: "" });

  const addMutation = useMutation({
    mutationFn: () => add({ data: { ...form, label: form.label || undefined } }),
    onSuccess: () => {
      toast.success("Device whitelisted");
      setForm({ ssid: "", bssid: "", label: "" });
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("Could not add device", { description: e.message }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed from whitelist");
      void queryClient.invalidateQueries();
    },
  });

  return (
    <Shell>
      <p className="label-mono">Known good hardware</p>
      <h1 className="mt-1 text-3xl font-semibold">BSSID whitelist</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Mark the hardware addresses of routers you own. When another device broadcasts the same
        network name from a different address, WiFiShield flags it as a possible evil twin instead
        of treating both as suspicious.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <form
          className="panel h-fit space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate();
          }}
        >
          <h2 className="text-sm font-semibold">Add a trusted device</h2>
          <div className="space-y-1">
            <label className="label-mono" htmlFor="ssid">
              Network name
            </label>
            <Input
              id="ssid"
              required
              value={form.ssid}
              onChange={(e) => setForm({ ...form, ssid: e.target.value })}
              placeholder="HomeNet_5G"
            />
          </div>
          <div className="space-y-1">
            <label className="label-mono" htmlFor="bssid">
              Hardware address (BSSID)
            </label>
            <Input
              id="bssid"
              required
              value={form.bssid}
              onChange={(e) => setForm({ ...form, bssid: e.target.value })}
              placeholder="AA:BB:CC:DD:EE:FF"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="label-mono" htmlFor="label">
              Label (optional)
            </label>
            <Input
              id="label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Living room router"
            />
          </div>
          <Button type="submit" className="w-full" disabled={addMutation.isPending}>
            <Plus className="size-4" /> Add to whitelist
          </Button>

          {data.networks.length > 0 ? (
            <div className="pt-2">
              <p className="label-mono">Quick add from latest scan</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.networks.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setForm({ ssid: n.ssid, bssid: n.bssid, label: n.vendor ?? "" })}
                    className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {n.ssid}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>

        <div className="panel overflow-hidden">
          {data.trusted.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No trusted devices yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left">
                  {["Network", "Hardware address", "Added", ""].map((h) => (
                    <th key={h} className="label-mono px-4 py-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trusted.map((t) => (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.ssid}</div>
                      {t.label ? (
                        <div className="text-xs text-muted-foreground">{t.label}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{t.bssid}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatTime(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove"
                        onClick={() => delMutation.mutate(t.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
