// Parses real Wi-Fi scan output pasted from a phone or laptop.
// Supports Windows (netsh), Linux (nmcli) and macOS (airport -s) formats.

import { channelToFrequency, finalizeNetworks, type DraftNetwork, type Encryption } from "./wifi";

type RawNetwork = Omit<DraftNetwork, "security_score" | "risk" | "duplicate_ssid" | "evil_twin">;

const MAC = /\b([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}\b/;

export function encryptionFromText(text: string): Encryption {
  const t = text.toUpperCase();
  if (t.includes("WPA3") || t.includes("SAE")) return "WPA3";
  if (t.includes("WPA2") || t.includes("RSN")) return "WPA2";
  if (t.includes("WPA")) return "WPA";
  if (t.includes("WEP")) return "WEP";
  return "OPEN";
}

/** netsh reports signal as a 0-100% quality value. */
export function qualityToDbm(quality: number): number {
  return Math.round(Math.max(0, Math.min(100, quality)) / 2 - 100);
}

function parseNetsh(text: string): RawNetwork[] {
  if (!/SSID\s+\d+\s*:/i.test(text)) return [];
  const out: RawNetwork[] = [];
  let ssid = "";
  let auth = "";
  let pending: Partial<RawNetwork> | null = null;

  const flush = () => {
    if (pending?.bssid) {
      out.push({
        ssid: ssid || "(hidden)",
        bssid: pending.bssid.toUpperCase(),
        vendor: "",
        signal_dbm: pending.signal_dbm ?? -70,
        channel: pending.channel ?? 1,
        frequency_mhz: channelToFrequency(pending.channel ?? 1),
        encryption: encryptionFromText(auth),
        wps_enabled: false,
      });
    }
    pending = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const ssidMatch = line.match(/^\s*SSID\s+\d+\s*:\s*(.*)$/i);
    if (ssidMatch) {
      flush();
      ssid = ssidMatch[1]!.trim();
      auth = "";
      continue;
    }
    const authMatch = line.match(/^\s*Authentication\s*:\s*(.*)$/i);
    if (authMatch) {
      auth = authMatch[1]!.trim();
      continue;
    }
    const bssidMatch = line.match(/^\s*BSSID\s+\d+\s*:\s*(.*)$/i);
    if (bssidMatch) {
      flush();
      pending = { bssid: bssidMatch[1]!.trim() };
      continue;
    }
    if (!pending) continue;
    const signal = line.match(/^\s*Signal\s*:\s*(\d+)\s*%/i);
    if (signal) pending.signal_dbm = qualityToDbm(Number(signal[1]));
    const channel = line.match(/^\s*Channel\s*:\s*(\d+)/i);
    if (channel) pending.channel = Number(channel[1]);
  }
  flush();
  return out;
}

/** Tolerant row parser for nmcli / airport-style tables. */
function parseTable(text: string): RawNetwork[] {
  const out: RawNetwork[] = [];
  for (const line of text.split(/\r?\n/)) {
    const macMatch = line.match(MAC);
    if (!macMatch) continue;
    const bssid = macMatch[0].toUpperCase();
    const before = line.slice(0, macMatch.index ?? 0).trim();
    const after = line.slice((macMatch.index ?? 0) + bssid.length).trim();

    const ssid = before.replace(/^[*\s]+/, "").replace(/\s{2,}.*$/, "").trim() || "(hidden)";
    const tokens = after.split(/[\s|]+/).filter(Boolean);

    let channel = 0;
    let dbm = 0;
    let quality = 0;
    for (const token of tokens) {
      const num = Number(token.replace("%", ""));
      if (Number.isNaN(num)) continue;
      if (num < 0 && !dbm) dbm = Math.round(num);
      else if (!channel && num > 0 && num <= 196) channel = Math.round(num);
      else if (!quality && num > 0 && num <= 100) quality = Math.round(num);
    }
    if (!dbm) dbm = quality ? qualityToDbm(quality) : -70;
    if (!channel) channel = 1;

    out.push({
      ssid,
      bssid,
      vendor: "",
      signal_dbm: Math.max(-100, Math.min(-20, dbm)),
      channel,
      frequency_mhz: channelToFrequency(channel),
      encryption: encryptionFromText(after),
      wps_enabled: /WPS/i.test(after),
    });
  }
  return out;
}

export function parseScanText(text: string): DraftNetwork[] {
  const rows = parseNetsh(text);
  const parsed = rows.length > 0 ? rows : parseTable(text);
  // Drop duplicate BSSIDs from repeated scan blocks.
  const seen = new Set<string>();
  const unique = parsed.filter((n) => {
    if (seen.has(n.bssid)) return false;
    seen.add(n.bssid);
    return true;
  });
  return finalizeNetworks(unique);
}

export const IMPORT_EXAMPLES = [
  { os: "Windows", command: "netsh wlan show networks mode=bssid" },
  { os: "Linux", command: "nmcli -f SSID,BSSID,CHAN,SIGNAL,SECURITY dev wifi" },
  {
    os: "macOS",
    command:
      "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/A/Resources/airport -s",
  },
] as const;
