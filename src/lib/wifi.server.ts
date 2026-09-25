import { createClient } from "@supabase/supabase-js";

import { simulateScan, summarize, type DraftNetwork } from "./wifi";

function client() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export async function performScan() {
  const db = client();
  const { data: trusted } = await db.from("trusted_bssids").select("bssid");
  const trustedSet = new Set((trusted ?? []).map((t) => String(t.bssid).toUpperCase()));

  const networks: DraftNetwork[] = simulateScan().map((n) => ({
    ...n,
    // A whitelisted router keeps its good standing; only the unknown MAC
    // broadcasting the same SSID is flagged as an imposter.
    evil_twin: n.duplicate_ssid && !trustedSet.has(n.bssid.toUpperCase()),
  }));

  const summary = summarize(networks);

  const { data: scan, error } = await db
    .from("scans")
    .insert({ ...summary, source: "simulator" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: netError } = await db
    .from("networks")
    .insert(networks.map((n) => ({ ...n, scan_id: scan.id })));
  if (netError) throw new Error(netError.message);

  return { scanId: scan.id as string, ...summary };
}

export async function listScans(limit = 50) {
  const db = client();
  const { data, error } = await db
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getScanDetail(scanId: string) {
  const db = client();
  const [{ data: scan, error }, { data: networks, error: netError }] = await Promise.all([
    db.from("scans").select("*").eq("id", scanId).maybeSingle(),
    db.from("networks").select("*").eq("scan_id", scanId).order("signal_dbm", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  if (netError) throw new Error(netError.message);
  return { scan, networks: networks ?? [] };
}

export async function getLatest() {
  const db = client();
  const { data: scans, error } = await db
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  const latest = scans?.[0] ?? null;
  if (!latest) return { latest: null, networks: [], history: [] };

  const { data: networks, error: netError } = await db
    .from("networks")
    .select("*")
    .eq("scan_id", latest.id)
    .order("signal_dbm", { ascending: false });
  if (netError) throw new Error(netError.message);

  return { latest, networks: networks ?? [], history: [...(scans ?? [])].reverse() };
}

export async function getSignalHistory() {
  const db = client();
  const { data, error } = await db
    .from("networks")
    .select("ssid,bssid,signal_dbm,channel,created_at,security_score,encryption")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTrusted() {
  const db = client();
  const { data, error } = await db
    .from("trusted_bssids")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addTrusted(input: { ssid: string; bssid: string; label?: string | undefined }) {
  const db = client();
  const { data, error } = await db
    .from("trusted_bssids")
    .insert({
      ssid: input.ssid,
      bssid: input.bssid.toUpperCase(),
      label: input.label?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeTrusted(id: string) {
  const db = client();
  const { error } = await db.from("trusted_bssids").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteScan(id: string) {
  const db = client();
  const { error } = await db.from("scans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function lookupCve(vendor: string) {
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(
    `${vendor} router`,
  )}&resultsPerPage=8`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { vendor, results: [], error: `NVD responded ${res.status}` };
    }
    const json = (await res.json()) as {
      vulnerabilities?: {
        cve: {
          id: string;
          published: string;
          descriptions?: { lang: string; value: string }[];
          metrics?: Record<string, { cvssData?: { baseScore?: number; baseSeverity?: string } }[]>;
        };
      }[];
    };
    const results = (json.vulnerabilities ?? []).map((v) => {
      const metric = Object.values(v.cve.metrics ?? {})[0]?.[0]?.cvssData;
      return {
        id: v.cve.id,
        published: v.cve.published,
        summary:
          v.cve.descriptions?.find((d) => d.lang === "en")?.value ?? "No description available.",
        score: metric?.baseScore ?? null,
        severity: metric?.baseSeverity ?? null,
      };
    });
    return { vendor, results, error: null as string | null };
  } catch {
    return { vendor, results: [], error: "Could not reach the vulnerability database." };
  }
}

/** Persists a set of real (imported or live) networks as a new scan. */
export async function saveScan(networks: DraftNetwork[], source: string) {
  const db = client();
  const { data: trusted } = await db.from("trusted_bssids").select("bssid");
  const trustedSet = new Set((trusted ?? []).map((t) => String(t.bssid).toUpperCase()));

  const rows = networks.map((n) => ({
    ...n,
    evil_twin: n.duplicate_ssid && !trustedSet.has(n.bssid.toUpperCase()),
  }));
  const summary = summarize(rows);

  const { data: scan, error } = await db
    .from("scans")
    .insert({ ...summary, source })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: netError } = await db
    .from("networks")
    .insert(rows.map((n) => ({ ...n, scan_id: scan.id })));
  if (netError) throw new Error(netError.message);

  return { scanId: scan.id as string, ...summary };
}

/** Latest real (live or imported) scans and their networks. */
export async function getRealScans() {
  const db = client();
  const { data: scans, error } = await db
    .from("scans")
    .select("*")
    .neq("source", "simulator")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  const latest = scans?.[0] ?? null;
  if (!latest) return { latest: null, networks: [], scans: [] };
  const { data: networks, error: netError } = await db
    .from("networks")
    .select("*")
    .eq("scan_id", latest.id)
    .order("signal_dbm", { ascending: false });
  if (netError) throw new Error(netError.message);
  return { latest, networks: networks ?? [], scans: scans ?? [] };
}
