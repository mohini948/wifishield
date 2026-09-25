CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  network_count INT NOT NULL DEFAULT 0,
  avg_score INT NOT NULL DEFAULT 0,
  critical_count INT NOT NULL DEFAULT 0,
  warning_count INT NOT NULL DEFAULT 0,
  safe_count INT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'simulator'
);

CREATE TABLE public.networks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ssid TEXT NOT NULL,
  bssid TEXT NOT NULL,
  vendor TEXT,
  signal_dbm INT NOT NULL,
  channel INT NOT NULL,
  frequency_mhz INT NOT NULL,
  encryption TEXT NOT NULL,
  wps_enabled BOOLEAN NOT NULL DEFAULT false,
  security_score INT NOT NULL,
  risk TEXT NOT NULL,
  duplicate_ssid BOOLEAN NOT NULL DEFAULT false,
  evil_twin BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX networks_scan_id_idx ON public.networks(scan_id);
CREATE INDEX networks_ssid_idx ON public.networks(ssid);

CREATE TABLE public.trusted_bssids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ssid TEXT NOT NULL,
  bssid TEXT NOT NULL UNIQUE,
  label TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.networks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_bssids TO anon, authenticated;
GRANT ALL ON public.scans TO service_role;
GRANT ALL ON public.networks TO service_role;
GRANT ALL ON public.trusted_bssids TO service_role;

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_bssids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to scans" ON public.scans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access to networks" ON public.networks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access to trusted bssids" ON public.trusted_bssids FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);