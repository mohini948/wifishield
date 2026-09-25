import { AlertTriangle, ShieldAlert, ShieldCheck, Wifi } from "lucide-react";
import type { ReactNode } from "react";

import { estimatedThroughput, signalLabel, signalQuality } from "@/lib/wifi";
import { cn } from "@/lib/utils";

export function RiskBadge({ risk }: { risk: string }) {
  const map = {
    safe: { cls: "bg-safe/15 text-safe border-safe/30", Icon: ShieldCheck, text: "Safe" },
    warning: { cls: "bg-warn/15 text-warn border-warn/30", Icon: AlertTriangle, text: "Warning" },
    critical: { cls: "bg-crit/15 text-crit border-crit/35", Icon: ShieldAlert, text: "Critical" },
  } as const;
  const item = map[risk as keyof typeof map] ?? map.warning;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        item.cls,
      )}
    >
      <item.Icon className="size-3" />
      {item.text}
    </span>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const tone = score < 40 ? "bg-crit" : score < 70 ? "bg-warn" : "bg-safe";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{score}</span>
    </div>
  );
}

export function SignalMeter({ dbm }: { dbm: number }) {
  const q = signalQuality(dbm);
  const bars = Math.max(1, Math.ceil(q / 25));
  return (
    <div className="flex items-center gap-2" title={`${signalLabel(dbm)} · ${q}%`}>
      <span className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1 rounded-sm",
              i <= bars ? "bg-primary" : "bg-muted",
            )}
            style={{ height: `${4 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{dbm} dBm</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "safe" | "warn" | "crit";
}) {
  const toneCls = {
    default: "text-foreground",
    safe: "text-safe",
    warn: "text-warn",
    crit: "text-crit",
  }[tone];
  return (
    <div className="panel p-4">
      <p className="label-mono">{label}</p>
      <p className={cn("mt-2 font-mono text-3xl tabular-nums", toneCls)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export interface NetworkLike {
  id: string;
  ssid: string;
  bssid: string;
  vendor: string | null;
  signal_dbm: number;
  channel: number;
  frequency_mhz: number;
  encryption: string;
  wps_enabled: boolean;
  security_score: number;
  risk: string;
  evil_twin: boolean;
}

export function NetworkTable({
  networks,
  onSelect,
}: {
  networks: NetworkLike[];
  onSelect?: (n: NetworkLike) => void;
}) {
  if (networks.length === 0) {
    return (
      <div className="panel grid place-items-center gap-2 p-10 text-center">
        <Wifi className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No access points recorded yet.</p>
      </div>
    );
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left">
            {["Network", "Signal", "Channel", "Encryption", "Score", "Risk"].map((h) => (
              <th key={h} className="label-mono px-4 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {networks.map((n) => (
            <tr
              key={n.id}
              onClick={() => onSelect?.(n)}
              className={cn(
                "border-b border-border/40 last:border-0 transition-colors hover:bg-secondary/40",
                onSelect && "cursor-pointer",
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium">
                  {n.ssid}
                  {n.evil_twin ? (
                    <span className="rounded border border-crit/40 bg-crit/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-crit">
                      Evil twin
                    </span>
                  ) : null}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {n.bssid}
                  {n.vendor ? ` · ${n.vendor}` : ""}
                </div>
              </td>
              <td className="px-4 py-3">
                <SignalMeter dbm={n.signal_dbm} />
                <div className="font-mono text-[11px] text-muted-foreground">
                  ~{estimatedThroughput(n.signal_dbm, n.channel)} Mbps
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {n.channel}
                <span className="block">{(n.frequency_mhz / 1000).toFixed(3)} GHz</span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs">{n.encryption}</span>
                {n.wps_enabled ? (
                  <span className="ml-2 rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 font-mono text-[10px] text-warn">
                    WPS
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <ScoreBar score={n.security_score} />
              </td>
              <td className="px-4 py-3">
                <RiskBadge risk={n.risk} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
