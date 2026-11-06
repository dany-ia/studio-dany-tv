#!/usr/bin/env bash
# Validate the app without a TV: GLSL ES 1.00 shaders (glslangValidator), JS syntax, JSON files.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
node -e "
const vm=require('vm'); const w={}; vm.runInNewContext(require('fs').readFileSync('app/StudioDanyTV/js/shaders.js','utf8'),{window:w});
require('fs').writeFileSync('$TMP/sky.frag','#version 100\n'+w.SHADERS.SKY); require('fs').writeFileSync('$TMP/main.frag','#version 100\n'+w.SHADERS.MAIN);"
if command -v glslangValidator >/dev/null; then glslangValidator "$TMP/sky.frag" && glslangValidator "$TMP/main.frag" && echo "GLSL ES 1.00: ok"; else echo "glslangValidator not found (brew install glslang) — skipping shader check"; fi
for f in app/StudioDanyTV/js/*.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" && echo "js ok  $f"; done
for j in app/StudioDanyTV/*.json; do node -e "JSON.parse(require('fs').readFileSync('$j','utf8'))" && echo "json ok $j"; done
rm -rf "$TMP"
