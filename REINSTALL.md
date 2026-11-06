# REINSTALL — redeploy Studio Dany TV in 5 minutes

For after a TV firmware update, a Mac reinstall, or a lost Developer Mode setting.
Private values (IPs, DUID, password) are in `.local/` (git-ignored); the placeholders below
are what to look up there.

## 0. What is where
| Thing | Path |
|---|---|
| Tizen SDK + TV extension | `~/tizen-sdk` (10.0, tv-samsung-10.0) |
| Signing certs + profile `studiodany` | `~/tizen-sdk-data/keystore/samsung/studiodany/`, `~/tizen-sdk-data/profile/profiles.xml` |
| Certificate password | `.local/cert-password.env` (format `TIZEN_CERTIFICATE_PASSWORD=...`) |
| Samsung agent skills (runners) | `~/.claude/plugins/cache/tizen-platform/tizen-sdk-skills/<ver>/lib/cli/*.js` |
| TV inventory (IP, DUID, serial) | `.local/device-inventory.md` |
| Apps | `app/StudioDanyHello` (phase 1 test), `app/StudioDanyTV` (phase 2 ambient screen) |

Runner lookup used by every step below:
```bash
R=$(ls -d ~/.claude/plugins/cache/tizen-platform/tizen-sdk-skills/*/lib/cli | sort -V | tail -1)
```

## 1. TV side (remote control) — only if Developer Mode was lost
1. Home > Apps. With the Apps screen focused, press `1 2 3 4 5` on the remote (number pad, or
   the on-screen numeric keypad via the 123 button).
2. Developer mode: **On**. Host PC IP: the Mac's LAN IP (`ipconfig getifaddr en0`).
3. Power the TV fully off and on again (hold power on the remote until it restarts).
4. Check: `curl -s http://<tv-ip>:8001/api/v2/ | grep -o '"developer[^,]*'` shows
   `developerMode":"1"` and `developerIP` = the Mac.

## 2. Mac side — if the toolchain is gone
```bash
cd ~/Projects/personal/tv-studio
git clone https://github.com/Samsung/tizen-agent-skills.git .skills-src   # if missing
bash .skills-src/tizen-sdk-skills/claude/setup/setup.sh                     # installs runners into ~/.claude
node "$R/sdk-install-cli.js"        # prints the install command if the SDK is missing; run it
node "$R/tv-sdk-install-cli.js"     # same for the TV extension
```

## 3. Connect to the TV
```bash
node "$R/remote-device-cli.js" connect <tv-ip>          # serial becomes <tv-ip>:26101
node "$R/cert-manager-cli.js" acquire-duid --serial <tv-ip>:26101
```
If the DUID differs from `.local/device-inventory.md` (new panel / mainboard), redo step 4.

## 4. Certificate (only if `~/tizen-sdk-data` is gone or the DUID changed)
Samsung Account login opens in the browser; the author cert is tied to the account, the
distributor cert lists the TV DUID(s).
```bash
node "$R/cert-manager-cli.js" samsung-login --profile-name studiodany
node "$R/cert-manager-cli.js" generate-samsung-author --profile-name studiodany --identity "Daniel Villarreal" \
  --organization "Studio Dany" --city "Playa del Carmen" --country MX --password-file .local/cert-password.env
node "$R/cert-manager-cli.js" generate-samsung-distributor --profile-name studiodany --duid-list <DUID> \
  --privilege Public --password-file .local/cert-password.env
node "$R/cert-manager-cli.js" create-samsung-profile --profile-name studiodany --privilege Public --active
```
If only the DUID changed: `generate-samsung-distributor` refuses to overwrite; move the old
`distributor.p12`/`.pwd` aside first, then run the last two commands.

## 5. Build, install, launch
```bash
node "$R/project-manager-cli.js" build --project "$PWD/app/StudioDanyTV" --build-type Debug --sign-profile studiodany
node "$R/project-manager-cli.js" install --package "$PWD/app/StudioDanyTV/Debug/StudioDanyTV.wgt" --run
```

App ids: `E58Zxev8MZ.StudioDanyTV` (package `E58Zxev8MZ`); hello app `5Fl59spfJV.StudioDanyHello`.
Check the TV sees it: `curl -s http://<tv-ip>:8001/api/v2/applications/E58Zxev8MZ.StudioDanyTV`.

## 5b. Autorun on power-on (TV setting, one time)
On this firmware (UN98DU9000, Tizen 8, es_MX) the option is NOT under General & Privacy:
Menu key → **Características avanzadas** (Advanced Features) → **Opción de Pantalla Inicio**
(Start Screen Options) → **Ejecución de la última aplicación** (Autorun Last App): **On**.
"Iniciar con Inicio de Smart Hub" (Autorun Smart Hub Home) can stay On; it does not block it.
The General & Privacy list on this firmware ends at "Restablecer datos de fábrica" (factory reset):
there is nothing to enable there, so do not press OK at the bottom of that list.

Verified 2026-11-06 from the Mac with the network remote + camera: app in front → KEY_POWER
(standby, REST PowerState "standby") → WOL + KEY_POWER → the beach was back on its own with
Spotify still playing (`.local/evidence/nav-13..22-*.jpg`). Home still opens the Smart Hub.
Leave Studio Dany TV in the foreground when you turn the TV off. After a full power cut the
Smart Hub may come first; the app is then one Home → Apps press away.

After a standby/wake cycle the sdb link is gone: run the `remote-device-cli.js connect` line of
step 4 again before any install. To put the app back in front from the Mac, use the install
`--run` command of step 5; the
remote-channel `tools/tvremote.py launch` does not foreground an app that is already running
in the background (REST shows `"running": true, "visible": false`).

## 5b2. Spotify (primary audio)
The broker must be running on a LAN machine: `node tools/spotify-broker.js` (state in `.local/spotify/`:
`config.json` with client_id + app_key + allow_ips, `tokens.json` with the refresh token, `device.json`).
If the refresh token is gone: `node tools/spotify-broker.js --login` and approve in the browser.
The TV build needs `app/StudioDanyTV/config.local.json` (broker URL, app key, device id) before `build`.
To move the broker to another machine: copy `.local/spotify/`, run the script there, update `brokerUrl`
in `config.local.json`, rebuild. Without the broker the app plays the stream radio instead.

## 5a. If the router rebooted (IPs changed)
Seen 2026-11-06: a router reboot moved the Mac from .19 to .11 and the TV from .9 to .16. Symptoms:
sdb "failed to connect", the remote "No route to host", Spotify on the TV falls back to radio.
Find the TV again by scanning port 8001 (`curl http://192.168.0.N:8001/api/v2/` for N in 2..254,
the TV answers with its name) and fix, in this order:
1. The TV's Developer Mode **Host PC IP** must equal the Mac's current IP, or sdb is refused.
   Quickest: give the Mac its old IP back (`sudo networksetup -setmanual Wi-Fi 192.168.0.19
   255.255.255.0 192.168.0.1`, undo with `-setdhcp Wi-Fi`). Durable: DHCP reservations (5a2).
2. `.local/tv.env`: TV_IP / TV_SERIAL to the TV's current IP, then `remote-device-cli.js connect`.
3. `.local/spotify/config.json`: add the TV's IP to `allow_ips`, restart the broker.
4. `app/StudioDanyTV/config.local.json`: `brokerUrl` must be the Mac's IP, then rebuild + install.

## 5a2. DHCP reservations (do this once, so 5a stops happening)
Three devices must keep their addresses: the TV (sdb, remote, broker allow-list), the Mac (Developer
Mode Host PC IP, `brokerUrl`) and the Bose soundbar (Spotify Connect target; a moving IP is harmless
for Spotify itself but keeps the LAN tidy). MACs and current IPs are in `.local/device-inventory.md`.
1. Router admin page (`http://192.168.0.1`) → DHCP / LAN → "Reserved addresses" (name varies by
   vendor: *DHCP reservation*, *Static lease*, *Address reservation*). Add one entry per device,
   MAC → IP: TV `192.168.0.16`, Mac `192.168.0.19`, soundbar its current IP. Save, then reboot each
   device (or renew its lease) and check with `arp -a`.
2. The Mac: macOS rotates a *private Wi-Fi address* per network by default, which defeats a
   reservation. System Settings → Wi-Fi → (i) on this network → **Private Wi-Fi address: Off** (or
   *Fixed*), then reserve the MAC that `ifconfig en0 | grep ether` shows afterwards.
3. Once the Mac is reserved, go back to DHCP: `sudo networksetup -setdhcp Wi-Fi`.
Fallback when the router cannot reserve (ISP box, no admin access): keep manual IPs on both
ends. Mac: `sudo networksetup -setmanual Wi-Fi 192.168.0.19 255.255.255.0 192.168.0.1` (DNS:
`sudo networksetup -setdnsservers Wi-Fi 192.168.0.1`). TV: Menú → Conexión → Red → Estado de red →
Config. IP → IP manual, same gateway and mask. Either way, if the Mac's IP ever changes, update
the TV's Developer Mode Host PC IP (Apps → type 12345 → Host PC IP) and `brokerUrl` in
`config.local.json`, then rebuild (5a, steps 1 and 4).

## 5c. Remote control from the Mac (optional)
`.local/venv/bin/python tools/tvremote.py pair` once (accept the prompt on the TV), then
`tools/tvremote.py key KEY_HOME` etc. Needs `.local/tv.env` with `TV_IP` and `TV_MAC`.
Inside the app send one key per call (or `--delay 0.7`): bursts of keys are dropped by the web app,
although the TV's own menus accept them.

## 6. Rollback / recovery
- The app is a normal user app. **Back** on the remote exits it; **Home** always opens Smart Hub.
- Uninstall: `~/tizen-sdk/tools/sdb -s <tv-ip>:26101 uninstall <pkg-id>` (pkg id is the `package`
  attribute in the app's `config.xml`; the `shell pkgcmd` route is a no-op on retail TVs because the
  shell is restricted). Verified 2026-11-05: the TV returns to Smart Hub home by itself.
  Or on the TV: Home > Apps > Settings > Delete.
- Verify install state without sdb: `curl -s http://<tv-ip>:8001/api/v2/applications/<app-id>`
  (200 = installed, 404 = gone).
- Developer Mode can be turned off again with the same `12345` menu. Nothing else on the TV is changed.

## 7. Watcher (optional, for visual verification)
See `docs/WATCHER.md`. `python3 watcher/phonecam.py start`, scan the QR, aim the phone at the TV.
