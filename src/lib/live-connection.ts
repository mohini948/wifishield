// Everything the browser can honestly tell us about the connection we are on.

import { channelToFrequency, riskFromScore, type DraftNetwork, type Encryption } from "./wifi";

export interface LiveConnectionInput {
  isp: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  secure_context: boolean;
  connection_type: string | null;
}

export interface LiveFinding {
  label: string;
  detail: string;
  deduction: number;
}

/**
 * Scores the connection this device is actually using. The browser cannot read
 * the Wi-Fi encryption of the link, so that stays an explicit unknown rather
 * than a guess.
 */
export function scoreLiveConnection(input: LiveConnectionInput): {
  score: number;
  findings: LiveFinding[];
} {
  const findings: LiveFinding[] = [];
  if (!input.secure_context) {
    findings.push({
      label: "Page not served over HTTPS",
      detail: "Traffic on this page is not encrypted in transit.",
      deduction: 30,
    });
  }
  findings.push({
    label: "Link encryption not verifiable",
    detail:
      "Browsers cannot read the Wi-Fi encryption of the link. Confirm WPA2/WPA3 in your device Wi-Fi settings.",
    deduction: 15,
  });
  if (input.connection_type && input.connection_type !== "wifi" && input.connection_type !== "unknown") {
    findings.push({
      label: `Connection reported as ${input.connection_type}`,
      detail: "Results describe this link, not surrounding access points.",
      deduction: 0,
    });
  }
  if ((input.rtt_ms ?? 0) > 400) {
    findings.push({
      label: "High round-trip latency",
      detail: "Unusually slow responses can indicate congestion or an intercepting proxy.",
      deduction: 5,
    });
  }
  const score = Math.max(
    0,
    Math.min(100, 100 - findings.reduce((sum, f) => sum + f.deduction, 0)),
  );
  return { score, findings };
}

export function liveConnectionToNetwork(input: LiveConnectionInput): DraftNetwork {
  const { score } = scoreLiveConnection(input);
  const name = input.isp ? `${input.isp} (this device)` : "Current connection";
  return {
    ssid: name,
    bssid: "LOCAL:CONNECTION",
    vendor: input.isp ?? "Unknown ISP",
    signal_dbm: estimateDbm(input.downlink_mbps),
    channel: 0,
    frequency_mhz: channelToFrequency(0),
    encryption: "UNKNOWN" as Encryption,
    wps_enabled: false,
    security_score: score,
    risk: riskFromScore(score),
    duplicate_ssid: false,
    evil_twin: false,
  };
}

/** Rough signal estimate from measured downlink, so the meters stay meaningful. */
function estimateDbm(downlink: number | null): number {
  if (!downlink || downlink <= 0) return -70;
  if (downlink >= 50) return -45;
  if (downlink >= 20) return -55;
  if (downlink >= 5) return -65;
  return -78;
}
