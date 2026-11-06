# Contributing

Thanks for looking. This is a personal showcase, but fixes and new decorations are welcome.

## Ground rules
- The target is a real Samsung Tizen TV with a small mobile-class GPU (Mali-G51 on the 2024 DU9000).
  Every visual addition must keep **60 fps on the TV**. Measure with the dev overlay (key `0`)
  before and after; the benchmark harness is `Scene.bench()` in `js/scene.js`.
- Rendering rules learned the hard way (see `README.md`, "Performance notes"): keep the WebGL
  background at 1280x720, never touch a 1080p 2D canvas per frame, crop every cached-layer
  `drawImage` to its bounding box, cache animation frames, and let CSS do the 2x nearest-neighbour
  upscale of the sprite canvas.
- Shaders are GLSL ES 1.00 and must compile on WebGL1 too. Validate locally with
  `glslangValidator` (see `tools/validate.sh`).
- No external dependencies in the app. Plain ES5-compatible JavaScript (the TV engine is an older
  Chromium), one module per engine: `sky/sea` (shaders), `sprites`, `decor`, `ambient`, `weather`,
  `radio`, `app` (HUD + input).
- Decorations go in `app/StudioDanyTV/decorations.json`; add a primitive to `js/decor.js` only when
  the existing ones cannot express it.
- Radio stations go in `app/StudioDanyTV/radio.json`. Only public streams that you have verified
  play on a TV (key GREEN in the dev overlay runs the station test).
- The HUD is DOM text in Outfit (variable weight, vendored). Keep pixel fonts for in-scene signs
  and the dev overlay only.
- Spanish UI text uses proper accents (MIÉRCOLES, SÁBADO, ¡VIVA MÉXICO!). The pixel font in
  `js/sprites.js` covers A-Z, 0-9, ÁÉÍ, ¡ and !; extend it if you need more.

## Local preview without a TV
Open `app/StudioDanyTV/index.html` in Chrome with `--allow-file-access-from-files` and use URL
parameters: `?hour=23&code=95&month=12&day=31&wind=25&dev=1&radio=0`. Add `warm=150` to
pre-simulate the patrons so they are already seated, and on the machine that runs the Spotify
broker `broker=http://127.0.0.1:8899&readonly=1` to show the real now-playing block without
sending any playback command. Headless renders:
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --allow-file-access-from-files \
  --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1920,1080 --hide-scrollbars \
  --virtual-time-budget=6000 --screenshot=out.png "file://$PWD/app/StudioDanyTV/index.html?hour=18.25&dev=0&radio=0"
```

## Never commit
Certificates, signing passwords, the watcher's CA/pairing state, camera frames, TV tokens or
anything under `.local/`. The `.gitignore` already covers them; keep it that way.
