import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Radar, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IMPORT_EXAMPLES } from "@/lib/scan-import";
import { importScan, runLiveScan, runScan } from "@/lib/wifi.functions";
import type { LiveConnectionInput } from "@/lib/live-connection";

async function collectLiveConnection(): Promise<LiveConnectionInput> {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number; type?: string };
  };
  const c = nav.connection;

  let net: Record<string, string> = {};
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) net = (await res.json()) as Record<string, string>;
  } catch {
    // Offline or blocked by a privacy extension — the rest of the check still works.
  }

  return {
    isp: net["org"] ?? null,
    ip: net["ip"] ?? null,
    city: net["city"] ?? null,
    region: net["region"] ?? null,
    country: net["country_name"] ?? null,
    effective_type: c?.effectiveType ?? null,
    downlink_mbps: typeof c?.downlink === "number" ? c.downlink : null,
    rtt_ms: typeof c?.rtt === "number" ? c.rtt : null,
    secure_context: window.isSecureContext,
    connection_type: c?.type ?? null,
  };
}

export function ScanActions() {
  const queryClient = useQueryClient();
  const simulate = useServerFn(runScan);
  const live = useServerFn(runLiveScan);
  const importer = useServerFn(importScan);
  const [showImport, setShowImport] = useState(false);
  const [text, setText] = useState("");

  const refresh = () => void queryClient.invalidateQueries();

  const simulateMutation = useMutation({
    mutationFn: () => simulate(),
    onSuccess: (r) => {
      toast.success(`Demo sweep complete — ${r.network_count} networks`);
      refresh();
    },
    onError: (e: Error) => toast.error("Scan failed", { description: e.message }),
  });

  const liveMutation = useMutation({
    mutationFn: async () => live({ data: await collectLiveConnection() }),
    onSuccess: (r) => {
      toast.success("Checked the network you're on right now", {
        description: `Security score ${r.avg_score}/100 · ${r.findings.length} findings`,
      });
      refresh();
    },
    onError: (e: Error) => toast.error("Live check failed", { description: e.message }),
  });

  const importMutation = useMutation({
    mutationFn: () => importer({ data: { text } }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.network_count} real networks`);
      setText("");
      setShowImport(false);
      refresh();
    },
    onError: (e: Error) => toast.error("Import failed", { description: e.message }),
  });

  const [needAgent, setNeedAgent] = useState(false);
  const nearbyMutation = useMutation({
    mutationFn: async () => {
      let res: Response;
      try {
        res = await fetch("http://localhost:4545/scan");
      } catch {
        setNeedAgent(true);
        throw new Error("The WiFiShield scanner helper isn't running on this computer.");
      }
      const body = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!body.ok || !body.text) throw new Error(body.error ?? "Scan returned nothing");
      setNeedAgent(false);
      return importer({ data: { text: body.text } });
    },
    onSuccess: (r) => {
      toast.success(`Found ${r.network_count} real networks around you`);
      refresh();
    },
    onError: (e: Error) => toast.error("Nearby scan failed", { description: e.message }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => nearbyMutation.mutate()} disabled={nearbyMutation.isPending}>
        <Radar className={nearbyMutation.isPending ? "size-4 animate-spin" : "size-4"} />
        {nearbyMutation.isPending ? "Scanning area…" : "Scan nearby networks"}
      </Button>
      <Button variant="outline" onClick={() => liveMutation.mutate()} disabled={liveMutation.isPending}>
        <Wifi className={liveMutation.isPending ? "size-4 animate-pulse" : "size-4"} />
        {liveMutation.isPending ? "Checking…" : "Check my connection"}
      </Button>
      <Button variant="outline" onClick={() => setShowImport((v) => !v)}>
        <FileUp className="size-4" /> Import real scan
      </Button>
      <Button
        variant="ghost"
        onClick={() => simulateMutation.mutate()}
        disabled={simulateMutation.isPending}
      >
        Demo sweep
      </Button>

      {needAgent ? (
        <div className="panel mt-3 w-full p-4 text-sm">
          <p className="font-medium">One-time setup: start the scanner helper</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Browsers can't read Wi-Fi hardware, so a tiny helper does the scan. Install Node.js,
            then{" "}
            <a href="/wifi-agent.mjs" download className="text-primary underline">
              download the helper
            </a>{" "}
            and run it (or run <span className="font-mono">npm run agent</span> inside the project):
          </p>
          <p className="mt-2 font-mono text-[11px] text-primary">node wifi-agent.mjs</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep that window open, then click "Scan nearby networks" again.
          </p>
        </div>
      ) : null}


      {showImport ? (
        <div className="panel mt-3 w-full p-4">
          <p className="text-sm font-medium">Paste a real Wi-Fi scan</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Browsers are not allowed to list nearby Wi-Fi networks, so run one of these on your
            device and paste the output here:
          </p>
          <ul className="mt-2 space-y-1">
            {IMPORT_EXAMPLES.map((e) => (
              <li key={e.os} className="font-mono text-[11px] text-muted-foreground">
                <span className="text-primary">{e.os}:</span> {e.command}
              </li>
            ))}
          </ul>
          <textarea
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            rows={7}
            placeholder="Paste scan output…"
            className="mt-3 w-full rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary/50"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || text.trim().length < 5}
            >
              {importMutation.isPending ? "Analyzing…" : "Analyze networks"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
