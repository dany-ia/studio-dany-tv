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
Settings → All Settings → General & Privacy → Start Screen Options → **Autorun Last App: On**
(and Autorun Smart Hub Home: Off). The TV reopens whatever app was in front when it went to
standby, so leave Studio Dany TV in the foreground. A full power cut (not standby) may show the
Smart Hub first; the app is then one Home → Apps press away.

## 5c. Remote control from the Mac (optional)
`.local/venv/bin/python tools/tvremote.py pair` once (accept the prompt on the TV), then
`tools/tvremote.py key KEY_HOME` etc. Needs `.local/tv.env` with `TV_IP` and `TV_MAC`.

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
