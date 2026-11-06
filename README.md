# Studio Dany TV

A living pixel-art beach for a Samsung TV. A tiki bar in Playa del Carmen that follows the real
sun, the real weather and the Mexican calendar, with a lofi radio that changes with the time of day.
It runs as a signed Tizen web app on a stock 98" Samsung panel at a steady 60 fps, built and
deployed entirely from a Mac by an AI coding agent working through a phone camera pointed at the TV.

![Night at the bar, rendered at 1920x1080](docs/images/render-night.jpg)

![A full day in 48 frames](docs/images/day-cycle.gif)

| Noon | Rain | Día de Muertos | Summer |
|---|---|---|---|
| ![](docs/images/render-noon.jpg) | ![](docs/images/render-rain.jpg) | ![](docs/images/render-muertos.jpg) | ![](docs/images/render-summer.jpg) |

On the real panel, photographed through the watcher at sunset:

![The TV at 18:15](docs/images/tv-sunset-photo.jpg)

## What it does

- **Sky by the real clock.** Open-Meteo gives today's sunrise and sunset for the bar's coordinates;
  the sky interpolates pre-dawn, sunrise, day, golden hour, sunset, blue hour and night. The sun and
  moon travel across the sky, the moon shows its real phase, stars twinkle and the Milky Way comes
  out at night.
- **Weather by Open-Meteo.** The WMO weather code and wind speed drive clouds, rain over the sea
  and drops on the palapa, puddles on the counter, fog, lightning storms, wave height and palm sway.
  Night and rain still look cozy under the string lights.
- **Mexican calendar decorations.** Rosca de Reyes in January, hearts in February, Semana Santa
  tourists, papel picado for Cinco de Mayo and the Grito, pumpkins for Halloween, an ofrenda with
  cempasúchil and candles for Día de Muertos, Christmas lights and a piñata in December, and a
  New Year's Eve countdown. All of it is data in `decorations.json`.
- **A bar with a schedule.** Dark and closed from 3 to 6:30 with one lamp on, the bartender back
  at 6:30, regulars on the stools at golden hour, the grill lit at dinner, string lights from sunset.
- **Living scene.** Palms sway with the wind, the hammock swings, a pelican flies by, a crab walks
  its path, the Cozumel ferry and a sailboat cross the horizon, smoke rises from the fire pit,
  fireflies at night, and the bartender wipes glasses, shakes cocktails and pours.
- **HUD.** Big pixel clock with seconds, Spanish date, weather line (current, min/max, humidity,
  wind), radio slot and station.
- **Lofi radio by time of day.** Lofi Coffee in the morning, Lofi Reggae in the afternoon, Jazz
  Lofi at night, with a 2 s crossfade at the boundaries. OK toggles play/pause, left/right skips
  stations. Stations live in `radio.json`.
- **Dev overlay** on the `0` key to force any hour, weather code, month, day or wind, switch
  render quality, and run the benchmark or the radio test. Keys `1-4` jump to review hours,
  `6-9` to Día de Muertos, Christmas, rain and storm.

## Architecture

```mermaid
flowchart LR
  subgraph data [Data]
    OM[Open-Meteo<br/>sunrise, sunset, code, wind]
    CLK[Real clock]
    DJ[decorations.json]
    RJ[radio.json]
    DEV[Dev overlay overrides]
  end
  subgraph state [Scene state]
    ST[scene.js<br/>hour, light model, weather params, moon phase]
  end
  subgraph gpu [WebGL background, 1280x720, bilinear upscale]
    SKY[SKY pass → texture<br/>every 4th frame]
    MAIN[MAIN pass every frame<br/>samples sky, computes sea + sand]
  end
  subgraph cpu [2D sprite canvas, 960x540, CSS 2x nearest]
    SP[sprites.js<br/>cached layers + animated sprites]
    DC[decor.js]
    AM[ambient.js]
    WX[weather.js]
    LT[lighting pass<br/>night tint, light cast, bloom]
  end
  HUD[DOM HUD<br/>clock, date, weather, radio]
  RD[radio.js<br/>two audio elements, crossfade]
  OM --> ST
  CLK --> ST
  DEV --> ST
  ST --> SKY --> MAIN
  ST --> SP
  DJ --> DC --> SP
  AM --> SP
  WX --> SP
  SP --> LT
  RJ --> RD --> HUD
  ST --> HUD
```

Three layers are composited by the TV's browser: the WebGL canvas (sky, sea, sand base), the 2D
sprite canvas on top (transparent above the shore line), and the DOM HUD.

### The sky and sea shaders (`js/shaders.js`)

The light model is shared by both passes and by the sprite layer. With sunrise `r` and sunset
`s` in hours, `df = (hour - r) / (s - r)` is the fraction of daytime elapsed and `nf` the
fraction of the night. The light elevation is `sin(π·df)` by day and `-sin(π·nf)` by night, so it
crosses zero exactly at sunrise and sunset. Two scalars come out of it: `d`, the daylight amount
(a smoothstep of the elevation), and `tw`, a twilight bump that peaks when the sun is on the
horizon. Every colour in the sky is a blend of three palettes (night, twilight, day) weighted by
`d` and `tw`, so dawn and dusk get their pink and orange horizon for free.

The sky pass draws the gradient, the sun (glow mixed in rather than added, so it never
saturates to a blob), stars from a per-cell hash with a time-based twinkle, a Milky Way band of
fbm noise, the moon as a lit disc minus an offset dark disc (the offset is the phase), and clouds
as fbm noise sampled in perspective (divided by height above the horizon) so they flatten toward
the horizon and drift with the wind. Because the sky changes slowly, this pass renders to a
texture only every 4th frame, which is what makes the 5-octave quality tier affordable.

The main pass runs every frame. Above the horizon it just samples the sky texture. The sea gets
a deep-to-shallow Caribbean palette by distance to the shore, a reflection of the real sky sampled
just above the horizon (desaturated, so twilight doesn't turn the water pink), wave shading from
fbm in mild perspective, a vertical light path under the sun or moon filled with horizontal
shimmer streaks, a wavy foam line at the shore, and weather: rain speckle, overcast gloom, fog,
lightning flash. Wind and rain raise the waves.

### The sprite layer (`js/sprites.js`)

Everything is drawn in 960x540 logical pixels, and CSS scales the canvas 2x with
`image-rendering: pixelated`, so every pixel is the same size and no 1080p 2D work happens at all.
Static art (sand, bar back, bar front, light cast, bulb halos, post effects) is painted once into
offscreen canvases; palms and the hammock are cached as 16 and 12 quantized sway frames; only the
bartender, critters, particles and weather are drawn fresh each frame. A lighting pass at the end
applies the night tint (`source-atop`, so the sea behind stays untouched), twilight warmth,
the warm cast from the string lights on counter and sand, bulb bloom, and golden-hour shadows.

### The month engine (`js/decor.js` + `decorations.json`)

A rule is `{from: "MM-DD", to: "MM-DD", layers: [...]}`. Every matching rule's layers are painted
into three cached canvases by depth (`sand`, `back`, `front`) and repainted only when the day
changes. Layers name a primitive (`papel`, `sign`, `ofrenda`, `xmaslights`, `umbrella`,
`tourist`, `pumpkin`, ...) plus parameters. Candles and Christmas lights register glow sources
that are drawn after the night tint so they stay bright. The New Year's Eve `countdown` is the
only per-frame layer.

### The weather engine (`js/weather.js`)

Maps the WMO code to `{cloud, rain, fog, storm}`. Rain is a deterministic field of streaks
scrolling down and sheared by the wind, plus small drops bouncing off the palapa eave and the
sand and a shimmer on the counter's puddles. Storms schedule a lightning bolt every 6 to 18 s:
a jagged polyline in the sky, a white flash on the sprites and a `u_flash` boost in both shaders
(the sky texture is refreshed on that frame).

## Performance notes (what the TV taught us)

The 2024 DU9000 has a Mali-G51 behind WebGL2. Measured on the panel:

| Background | fps |
|---|---|
| Full-screen procedural shader at 1920x1080 | 27-33 |
| Same at 3840x2160 | 5-10 |
| 1280x720, sky every frame, 5 octaves | 46 |
| 1280x720, sky to texture every 4th frame, 5 octaves | **60** |

And on the 2D side, every operation costs per pixel touched: a single full-screen 1080p canvas
fill or blit costs several milliseconds, so the sprite canvas is 960x540, every cached layer is
drawn cropped to its bounding box, and sway animations are cached frames. With all of that, the
complete scene (background, sprites, HUD, radio) holds 60 fps; the storm, the heaviest state,
reads 57.

## Install on any Samsung Tizen TV

Tested on a UN98DU9000 (Tizen 8/9). Any 2017+ Samsung TV with Developer Mode should work.

1. **TV**: Home → Apps, type `1 2 3 4 5` on the remote, set Developer Mode **On** and the Host
   PC IP to your computer's LAN IP, then power the TV fully off and on.
2. **Computer**: clone this repo and Samsung's agent skills, which install the Tizen SDK for you:
   ```bash
   git clone https://github.com/dany-ia/studio-dany-tv.git && cd studio-dany-tv
   git clone https://github.com/Samsung/tizen-agent-skills.git .skills-src
   bash .skills-src/tizen-sdk-skills/claude/setup/setup.sh      # Claude Code; see their README for other hosts
   ```
   Then, in your agent (or with the runners under `~/.claude/plugins/cache/tizen-platform/.../lib/cli/`):
   install the Tizen SDK, install the TV SDK extension, `remote-device connect <tv-ip>`.
3. **Certificate**: a Samsung online-CA author certificate plus a distributor certificate that
   lists your TV's DUID (`cert-manager acquire-duid`), combined into a signing profile. The
   runners handle the Samsung Account login in your browser. Keep the password file private.
4. **Build and run**:
   ```bash
   node <runners>/project-manager-cli.js build --project "$PWD/app/StudioDanyTV" --build-type Debug --sign-profile <profile>
   node <runners>/project-manager-cli.js install --package "$PWD/app/StudioDanyTV/Debug/StudioDanyTV.wgt" --run
   ```
5. **Autorun on power-on**: Settings → All Settings → General & Privacy → Start Screen Options →
   **Autorun Last App** on. Leave the app in the foreground when you turn the TV off. Home and
   Smart Hub keep working; Back exits the app.
6. **Location**: change `lat`, `lon`, `tz` in `js/app.js` and the place name in `index.html`.

Step-by-step details, rollback and the 5-minute redeploy after a firmware update are in
[REINSTALL.md](REINSTALL.md). The phone-camera watcher used to see the TV from the agent is
documented in [docs/WATCHER.md](docs/WATCHER.md).

## Repository layout

```
app/StudioDanyTV/      the Tizen web app (index.html, js/, css/, fonts/, radio.json, decorations.json)
app/StudioDanyHello/   the phase-1 hello app used to prove the toolchain
watcher/               private phone-camera watcher (HTTPS, single-use pairing) + agent helper
tools/                 tvremote.py (Samsung WebSocket remote), validate.sh
docs/                  watcher guide, images
reference/             the original ambient mockup this started from
```

## Credits

- Methodology: [Samraaj's TV makeover prompt](https://gist.github.com/Samraaj/9c3d02af9a4d8573c38fc8ba2db0bf66)
  (camera watcher, no root, stock Home recoverable) and
  [victaphu/glass-home-samsung-tv](https://github.com/victaphu/glass-home-samsung-tv) for the
  original workflow.
- Toolchain: [Samsung/tizen-agent-skills](https://github.com/Samsung/tizen-agent-skills) (SDK
  install, certificates, build, deploy, all driven by the agent).
- Weather and sun: [Open-Meteo](https://open-meteo.com/) (free, no key).
- Radio: [SomaFM](https://somafm.com/), [laut.fm](https://laut.fm/), [FluxFM](https://www.fluxfm.de/),
  [I Love Radio](https://www.ilovemusic.de/), [Zeno.FM](https://zeno.fm/). Thank them, support them.
- Remote control: [samsungtvws](https://github.com/xchwarze/samsung-tv-ws-api).
- Fonts: Press Start 2P and VT323 (SIL OFL 1.1).
- Built with Claude Code.

## En español

Una playa pixel-art viva para una Samsung de 98 pulgadas: el bar de la palapa en Playa del
Carmen sigue el sol real (amanecer y atardecer de Open-Meteo), el clima real (lluvia, tormenta
con relámpagos, niebla, viento) y el calendario mexicano (Reyes, 14 de febrero, Semana Santa,
10 de mayo, Grito, Halloween, Día de Muertos con su ofrenda, Navidad y la cuenta regresiva de
Año Nuevo, todo editable en `decorations.json`). Reloj pixel con segundos, fecha en español,
clima y una radio lofi que cambia según la hora (café por la mañana, reggae por la tarde, jazz
de noche; estaciones en `radio.json`). Corre a 60 fps como app Tizen firmada, sin root ni
cambios al sistema: el Home y Smart Hub siguen funcionando. La guía de instalación para cualquier
Samsung Tizen está arriba y en `REINSTALL.md`.
