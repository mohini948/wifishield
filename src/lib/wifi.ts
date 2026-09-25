// Pure, browser-safe Wi-Fi domain logic: types, scoring, and the scan simulator.

export type Encryption = "OPEN" | "WEP" | "WPA" | "WPA2" | "WPA3";
export type Risk = "critical" | "warning" | "safe";

export interface NetworkRow {
  id: string;
  scan_id: string;
  created_at: string;
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
  duplicate_ssid: boolean;
  evil_twin: boolean;
}

export interface ScanRow {
  id: string;
  created_at: string;
  network_count: number;
  avg_score: number;
  critical_count: number;
  warning_count: number;
  safe_count: number;
  source: string;
}

export interface TrustedRow {
  id: string;
  created_at: string;
  ssid: string;
  bssid: string;
  label: string | null;
}

export interface DraftNetwork {
  ssid: string;
  bssid: string;
  vendor: string;
  signal_dbm: number;
  channel: number;
  frequency_mhz: number;
  encryption: Encryption;
  wps_enabled: boolean;
  security_score: number;
  risk: Risk;
  duplicate_ssid: boolean;
  evil_twin: boolean;
}

export const SCORING_RULES = [
  { label: "Open (no encryption)", deduction: 60, why: "All traffic is readable by anyone in range" },
  { label: "WEP encryption", deduction: 50, why: "IV reuse makes WEP crackable in under a minute" },
  { label: "WPA (TKIP)", deduction: 20, why: "TKIP has known weaknesses; AES is the modern baseline" },
  { label: "WPA2 (AES)", deduction: 5, why: "Solid, but WPA3 is the current standard" },
  { label: "WPS enabled", deduction: 15, why: "The 8-digit PIN has ~11,000 effective combinations" },
  { label: "Duplicate SSID", deduction: 10, why: "Same name, different MAC — a probable rogue AP" },
] as const;

export function encryptionDeduction(encryption: Encryption): number {
  switch (encryption) {
    case "OPEN":
      return 60;
    case "WEP":
      return 50;
    case "WPA":
      return 20;
    case "WPA2":
      return 5;
    default:
      return 0;
  }
}

export function scoreNetwork(input: {
  encryption: Encryption;
  wps_enabled: boolean;
  duplicate_ssid: boolean;
}): number {
  let score = 100;
  score -= encryptionDeduction(input.encryption);
  if (input.wps_enabled) score -= 15;
  if (input.duplicate_ssid) score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function riskFromScore(score: number): Risk {
  if (score < 40) return "critical";
  if (score < 70) return "warning";
  return "safe";
}

export function channelToFrequency(channel: number): number {
  if (channel <= 14) return 2407 + channel * 5;
  return 5000 + channel * 5;
}

export function signalQuality(dbm: number): number {
  // -30 dBm ≈ 100%, -90 dBm ≈ 0%
  return Math.max(0, Math.min(100, Math.round(((dbm + 90) / 60) * 100)));
}

export function signalLabel(dbm: number): string {
  if (dbm >= -50) return "Excellent";
  if (dbm >= -60) return "Good";
  if (dbm >= -70) return "Fair";
  if (dbm >= -80) return "Weak";
  return "Very weak";
}

/** Theoretical 802.11n/ac throughput estimate (Mbps) from signal + band. */
export function estimatedThroughput(dbm: number, channel: number): number {
  const band5 = channel > 14;
  const max = band5 ? 866 : 300;
  const q = signalQuality(dbm) / 100;
  return Math.round(max * Math.pow(q, 1.6));
}

const SSID_POOL = [
  "HomeNet_5G",
  "Airtel_9F2A",
  "JioFiber-2412",
  "TP-Link_Guest",
  "CafeMocha_Free",
  "NETGEAR47",
  "Hostel_WiFi",
  "SkyBroadband",
  "Linksys00231",
  "AndroidAP_7761",
  "Library_Public",
  "OfficeCorp",
];

const VENDORS = [
  "TP-Link",
  "Netgear",
  "Cisco",
  "D-Link",
  "Xiaomi",
  "Huawei",
  "Ubiquiti",
  "Asus",
  "Linksys",
];

const CHANNELS_24 = [1, 3, 6, 9, 11];
const CHANNELS_5 = [36, 40, 44, 48, 149, 153, 157, 161];

function pick<T>(arr: readonly T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}

function randomBssid(rnd: () => number): string {
  return Array.from({ length: 6 }, () =>
    Math.floor(rnd() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase(),
  ).join(":");
}

function randomEncryption(rnd: () => number): Encryption {
  const r = rnd();
  if (r < 0.07) return "OPEN";
  if (r < 0.12) return "WEP";
  if (r < 0.24) return "WPA";
  if (r < 0.82) return "WPA2";
  return "WPA3";
}

/**
 * Generates a realistic set of nearby access points, including occasional
 * duplicate-SSID / different-BSSID pairs (the Evil Twin signal).
 */
export function simulateScan(options?: { rnd?: () => number }): DraftNetwork[] {
  const rnd = options?.rnd ?? Math.random;
  const count = 7 + Math.floor(rnd() * 6);
  const chosen = [...SSID_POOL].sort(() => rnd() - 0.5).slice(0, count);

  const drafts: Omit<DraftNetwork, "security_score" | "risk" | "duplicate_ssid" | "evil_twin">[] = [];

  for (const ssid of chosen) {
    const band5 = rnd() < 0.45;
    const channel = band5 ? pick(CHANNELS_5, rnd) : pick(CHANNELS_24, rnd);
    const encryption = randomEncryption(rnd);
    drafts.push({
      ssid,
      bssid: randomBssid(rnd),
      vendor: pick(VENDORS, rnd),
      signal_dbm: -Math.round(35 + rnd() * 55),
      channel,
      frequency_mhz: channelToFrequency(channel),
      encryption,
      wps_enabled: encryption !== "OPEN" && rnd() < 0.28,
    });
  }

  // Occasionally clone an SSID with a different BSSID — the rogue AP case.
  if (rnd() < 0.6 && drafts.length > 0) {
    const victim = drafts[Math.floor(rnd() * drafts.length)]!;
    const channel = pick(CHANNELS_24, rnd);
    drafts.push({
      ssid: victim.ssid,
      bssid: randomBssid(rnd),
      vendor: pick(VENDORS, rnd),
      signal_dbm: -Math.round(30 + rnd() * 30),
      channel,
      frequency_mhz: channelToFrequency(channel),
      encryption: rnd() < 0.5 ? "OPEN" : "WPA2",
      wps_enabled: rnd() < 0.4,
    });
  }

  return finalizeNetworks(drafts);
}

/** Applies duplicate-SSID detection and security scoring to raw scan results. */
export function finalizeNetworks(
  raw: Omit<DraftNetwork, "security_score" | "risk" | "duplicate_ssid" | "evil_twin">[],
): DraftNetwork[] {
  const counts = new Map<string, number>();
  for (const n of raw) counts.set(n.ssid, (counts.get(n.ssid) ?? 0) + 1);

  return raw.map((n) => {
    const duplicate_ssid = (counts.get(n.ssid) ?? 0) > 1;
    const security_score = scoreNetwork({
      encryption: n.encryption,
      wps_enabled: n.wps_enabled,
      duplicate_ssid,
    });
    return {
      ...n,
      duplicate_ssid,
      evil_twin: duplicate_ssid,
      security_score,
      risk: riskFromScore(security_score),
    };
  });
}

export function summarize(networks: { security_score: number; risk: string }[]) {
  const total = networks.length;
  const avg = total
    ? Math.round(networks.reduce((s, n) => s + n.security_score, 0) / total)
    : 0;
  return {
    network_count: total,
    avg_score: avg,
    critical_count: networks.filter((n) => n.risk === "critical").length,
    warning_count: networks.filter((n) => n.risk === "warning").length,
    safe_count: networks.filter((n) => n.risk === "safe").length,
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
