#!/usr/bin/env bash
# Build, sign and install Studio Dany TV on the TV, then launch it (REINSTALL.md steps 3 and 5 in one go).
# Run on the Mac that has the Tizen SDK:  bash tools/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source .local/tv.env                                  # TV_IP (git-ignored)
R=$(ls -d ~/.claude/plugins/cache/tizen-platform/tizen-sdk-skills/*/lib/cli | sort -V | tail -1)
bash tools/validate.sh
echo "== connect $TV_IP"
node "$R/remote-device-cli.js" connect "$TV_IP"
echo "== build"
node "$R/project-manager-cli.js" build --project "$PWD/app/StudioDanyTV" --build-type Debug --sign-profile studiodany
echo "== install + run"
node "$R/project-manager-cli.js" install --package "$PWD/app/StudioDanyTV/Debug/StudioDanyTV.wgt" --run
echo "== listo: la playa debe estar al frente en la TV"
