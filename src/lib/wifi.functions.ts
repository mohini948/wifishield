import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runScan = createServerFn({ method: "POST" }).handler(async () => {
  const { performScan } = await import("./wifi.server");
  return performScan();
});

export const fetchDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { getLatest } = await import("./wifi.server");
  return getLatest();
});

export const fetchScans = createServerFn({ method: "GET" }).handler(async () => {
  const { listScans } = await import("./wifi.server");
  return listScans();
});

export const fetchScanDetail = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ scanId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getScanDetail } = await import("./wifi.server");
    return getScanDetail(data.scanId);
  });

export const fetchSignalHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { getSignalHistory } = await import("./wifi.server");
  return getSignalHistory();
});

export const fetchTrusted = createServerFn({ method: "GET" }).handler(async () => {
  const { listTrusted } = await import("./wifi.server");
  return listTrusted();
});

export const createTrusted = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        ssid: z.string().min(1).max(64),
        bssid: z
          .string()
          .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, "Use AA:BB:CC:DD:EE:FF format"),
        label: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { addTrusted } = await import("./wifi.server");
    return addTrusted(data);
  });

export const deleteTrusted = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { removeTrusted } = await import("./wifi.server");
    return removeTrusted(data.id);
  });

export const removeScan = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteScan } = await import("./wifi.server");
    return deleteScan(data.id);
  });

export const cveLookup = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ vendor: z.string().min(2).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { lookupCve } = await import("./wifi.server");
    return lookupCve(data.vendor);
  });

const liveInputSchema = z.object({
  isp: z.string().max(120).nullable(),
  ip: z.string().max(64).nullable(),
  city: z.string().max(120).nullable(),
  region: z.string().max(120).nullable(),
  country: z.string().max(120).nullable(),
  effective_type: z.string().max(32).nullable(),
  downlink_mbps: z.number().nullable(),
  rtt_ms: z.number().nullable(),
  secure_context: z.boolean(),
  connection_type: z.string().max(32).nullable(),
});

export const runLiveScan = createServerFn({ method: "POST" })
  .inputValidator((data) => liveInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { liveConnectionToNetwork, scoreLiveConnection } = await import("./live-connection");
    const { saveScan } = await import("./wifi.server");
    const result = await saveScan([liveConnectionToNetwork(data)], "live");
    return { ...result, findings: scoreLiveConnection(data).findings };
  });

export const importScan = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ text: z.string().min(5).max(200_000) }).parse(data))
  .handler(async ({ data }) => {
    const { parseScanText } = await import("./scan-import");
    const { saveScan } = await import("./wifi.server");
    const networks = parseScanText(data.text);
    if (networks.length === 0) {
      throw new Error(
        "No networks found in that text. Paste the full output of your Wi-Fi scan command.",
      );
    }
    return saveScan(networks, "imported");
  });

export const assistantReply = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(4000),
            }),
          )
          .min(1)
          .max(24),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getLatest } = await import("./wifi.server");
    const { askAssistant } = await import("./assistant.server");
    const { latest, networks } = await getLatest();

    const snapshot = latest
      ? [
          `Scan source: ${latest.source} (live = this device's connection, imported = real scan file, simulator = demo data)`,
          `Taken: ${new Date(latest.created_at).toISOString()}`,
          `Networks: ${latest.network_count}, average score ${latest.avg_score}/100`,
          `Critical: ${latest.critical_count}, warning: ${latest.warning_count}, safe: ${latest.safe_count}`,
          "Access points:",
          ...networks.map(
            (n) =>
              `- ${n.ssid} [${n.bssid}] ${n.encryption}${n.wps_enabled ? " +WPS" : ""}, ch ${n.channel}, ${n.signal_dbm} dBm, score ${n.security_score} (${n.risk})${n.evil_twin ? ", FLAGGED as possible evil twin" : ""}`,
          ),
        ].join("\n")
      : "No scans have been run yet.";

    return { reply: await askAssistant({ messages: data.messages, snapshot }) };
  });

export const fetchRealScans = createServerFn({ method: "GET" }).handler(async () => {
  const { getRealScans } = await import("./wifi.server");
  return getRealScans();
});
