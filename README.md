# WiFiShield — Wireless Network Security Analyzer

## Run it on your computer (after downloading the ZIP)

1. Install **Node.js 20+** from https://nodejs.org
2. Open a terminal in the project folder and run:

```sh
npm install
npm run start
```

`npm run start` launches both the website (http://localhost:8080) and the
local Wi-Fi scanner helper (http://localhost:4545). Open http://localhost:8080
and click **Scan nearby networks**.

The database and AI assistant are hosted — no database install is needed.
Keep the `.env` file inside the ZIP (it only holds public connection keys).
On Windows, run `npm run agent` and `npm run dev` in two separate terminals.

## Scanner helper
- Windows: uses `netsh wlan show networks mode=bssid`
- Linux: uses `nmcli` (NetworkManager)
- macOS: uses `airport -s` (older macOS versions)

Run it alone with `npm run agent`.
