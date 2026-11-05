# PROGRESS — Studio Dany TV

Private details (IPs, DUID, tokens) live in `.local/` (git-ignored). Dates are absolute.

## Verified observations
- 2026-11-05: TV identified over the LAN via its info endpoint: Samsung UN98DU9000FXZX, Tizen,
  3840x2160, lang es_MX. Developer Mode already ON with Host PC IP = this Mac; sdb port 26101 open.
  A Samsung soundbar (HW-LS60D) also answers on port 8001 and must be ignored.
- 2026-11-05: Mac has no Java and no Tizen tooling; Node 26, Python 3.14, ffmpeg 8 present.
- 2026-11-05: `tizen-sdk-skills` 1.7.0 (Samsung/tizen-agent-skills @ af741bc) installed via its
  Claude setup script into ~/.claude (skills, agents, hooks). Tizen SDK installing to ~/tizen-sdk.
- 2026-11-05: Watcher built (`watcher/`), auth paths tested with curl, synthetic frame viewed by
  the agent. Phone pairing pending.

## Decisions
- Platform route: signed Tizen web app (.wgt) over sdb, Samsung online-CA certificate with the
  TV's DUID. No root, no firmware changes.
- Watcher is stdlib Python + local CA (no mkcert dependency), per docs/WATCHER.md.
- Reference visual: `reference/tv_ambient_v1.html` (pixel clock, Spanish date, Open-Meteo, lofi radio,
  procedural city). Phase 2 builds on it.

## Blockers / waiting on user
- Scan the watcher QR with the phone (camera permission).
- Samsung Account login in the browser when the certificate step runs.

## Next action
- SDK install finishing -> install TV SDK extension -> sdb connect -> hello .wgt -> certificate -> deploy -> photo.
