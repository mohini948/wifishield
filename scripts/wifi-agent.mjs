#!/usr/bin/env node
// WiFiShield local scanner — lets the web app scan nearby Wi-Fi networks.
// Browsers cannot read Wi-Fi hardware, so this tiny helper runs the OS scan
// command and hands the raw output to the app at http://localhost:4545/scan.
// Run: node scripts/wifi-agent.mjs   (no dependencies needed)
import { execFile } from "node:child_process";
import http from "node:http";
import os from "node:os";

const PORT = 4545;

function scanCommand() {
  switch (os.platform()) {
    case "win32":
      return ["netsh", ["wlan", "show", "networks", "mode=bssid"]];
    case "darwin":
      return [
        "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
        ["-s"],
      ];
    default:
      return ["nmcli", ["-f", "SSID,BSSID,CHAN,SIGNAL,SECURITY", "dev", "wifi", "list", "--rescan", "yes"]];
  }
}

function runScan() {
  const [cmd, args] = scanCommand();
  return new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 20000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    ),
  );
}

http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    if (req.url?.startsWith("/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, platform: os.platform() }));
    }
    if (req.url?.startsWith("/scan")) {
      try {
        const text = await runScan();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, platform: os.platform(), text }));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
      }
      return;
    }
    res.writeHead(404).end();
  })
  .listen(PORT, "127.0.0.1", () =>
    console.log(`WiFiShield scanner ready on http://localhost:${PORT} — keep this window open.`),
  );
