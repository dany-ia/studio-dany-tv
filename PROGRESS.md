# PROGRESS — Studio Dany TV

Private details (IPs, DUID, tokens) live in `.local/` (git-ignored). Dates are absolute.

## Verified observations
- 2026-11-05: TV identified over the LAN via its info endpoint: Samsung UN98DU9000FXZX, Tizen,
  3840x2160, lang es_MX. Developer Mode already ON with Host PC IP = this Mac; sdb port 26101 open.
  A Samsung soundbar (HW-LS60D) also answers on port 8001 and must be ignored.
- 2026-11-05: Mac has no Java and no Tizen tooling; Node 26, Python 3.14, ffmpeg 8 present.
- 2026-11-05: `tizen-sdk-skills` 1.7.0 (Samsung/tizen-agent-skills @ af741bc) installed via its
  Claude setup script into ~/.claude (skills, agents, hooks). Tizen SDK installing to ~/tizen-sdk.
- 2026-11-05: Watcher built (`watcher/`), auth paths tested with curl. Phone paired (after a LAN
  firewall fix on the user's side); frames arrive every ~3 s and the agent reads them.
- 2026-11-05: Tizen SDK 10.0 + TV-SAMSUNG-Public 10.0 installed in ~/tizen-sdk. sdb connects to the
  TV over Wi-Fi. Capability: profile tv, platform_version 9.0, armv7, restricted retail shell
  (shell commands return nothing; install/launch/uninstall via sdb-native commands work).
- 2026-11-05: Samsung online-CA author + distributor certs issued (profile `studiodany`, TV DUID
  included, Public privilege). Hello app (`app/StudioDanyHello`) built, signed, installed and launched;
  watcher photo shows "HOLA, TV" with the live clock. Uninstall tested: TV returns to Smart Hub home
  on its own; reinstall works. Evidence in `.local/evidence/` (not committed).

## Decisions
- Platform route: signed Tizen web app (.wgt) over sdb, Samsung online-CA certificate with the
  TV's DUID. No root, no firmware changes.
- Watcher is stdlib Python + local CA (no mkcert dependency), per docs/WATCHER.md.
- Reference visual: `reference/tv_ambient_v1.html` (pixel clock, Spanish date, Open-Meteo, lofi radio,
  procedural city). Phase 2 builds on it.

## Showcase re-architecture (2026-11-05)
- Step A: WebGL2 available (Mali-G51). Full-screen procedural shader: 1080p 27-33 fps, 4K 5-10 fps,
  720p q1 60, 540p q2 60. Decision: GPU background at 720p, upscaled bilinear.
- Step B: sky pass to texture every 4th frame makes q2 (Milky Way) fit at 720p (60 fps; sky every
  frame = 46). Sprite layer on a 960x540 canvas scaled 2x by CSS (nearest). Per-pixel cost rules:
  crop cached-layer draws to their bbox, never touch a 1080p 2D canvas per frame, cache sway frames.
  Review photos at 06:30/12:00/18:15/23:00 via dev presets (keys 1-4). Known glitch to check: radio
  label occasionally renders garbled in daytime photos (will-change layers?).

- Step C (2026-11-05/06): weather engine, Mexico-calendar decorations (JSON), ambient animations,
  radio by time of day (11 streams verified on the TV). After trimming the per-frame shader work:
  60 fps clear night, 57 in a storm. Dev overlay hidden by default from step D.
- Feedback round after v1 (2026-11-06): smooth Outfit clock/date/weather with a time-of-day
  accent, 160 px cover bottom-left, wind model from Open-Meteo speed + gusts (palms, sea, hammock,
  string lights, debris), coffee bar 06:30-11:30 with a one-by-one prop swap until 12:00, night
  cast clipped to sand/counter with the bartender on his own palette, patron state machine with
  dog/kid/selfie on cached frames. Renders in `.local/render/`, photos in `.local/evidence/`.
- Step D (2026-11-06): README, MIT license, CONTRIBUTING, day-cycle GIF from headless Chrome,
  public repo github.com/dany-ia/studio-dany-tv.

## Phase 1 status: DONE
Home while the app is in front opens the Smart Hub; Back exits the app; the WebSocket remote from
the Mac (`tools/tvremote.py`) is paired and used for all menu navigation.

## Autorun on power-on: DONE (2026-11-06)
Found via remote + camera: Características avanzadas → Opción de Pantalla Inicio → Ejecución de la
última aplicación: On (not under General y privacidad on this firmware). Standby/wake test from the
Mac: the beach came back by itself, Spotify kept playing, Home still opens the Smart Hub. Photos in
`.local/evidence/nav-*.jpg`. Caveat: tested with a short standby; a cold boot after a power cut may
show the Smart Hub first.

## Next action (phase 2)
- Build `app/StudioDanyTV` from `reference/tv_ambient_v1.html`: pixel clock, Spanish date, Open-Meteo,
  lofi radio on OK, procedural city at 60 fps on the TV engine, scanlines/vignette. Autorun on power-on.
