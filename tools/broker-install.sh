#!/bin/sh
# Install (or update) the Spotify token broker on another Mac as a LaunchAgent, over ssh.
#   tools/broker-install.sh user@host.local
# Run from this repo on the machine that currently holds .local/spotify/ (config.json + tokens.json).
# Stop any broker still running here first: the PKCE refresh token rotates, so two brokers refreshing
# the same token invalidate each other. Nothing under .local/ is ever committed.
set -eu
HOST="${1:?usage: tools/broker-install.sh user@host}"
DEST=studiodany   # relative to the remote home: scp does not expand \$HOME
cd "$(dirname "$0")/.."
[ -f .local/spotify/config.json ] && [ -f .local/spotify/tokens.json ] || { echo "missing .local/spotify/config.json or tokens.json"; exit 1; }

echo "== node on $HOST"
NODE=$(ssh "$HOST" 'command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1' || true)
if [ -z "$NODE" ]; then
  echo "node not found on $HOST; installing with Homebrew"
  ssh "$HOST" '/opt/homebrew/bin/brew install node || brew install node'
  NODE=$(ssh "$HOST" 'command -v node || ls /opt/homebrew/bin/node /usr/local/bin/node 2>/dev/null | head -1')
fi
echo "node: $NODE ($(ssh "$HOST" "$NODE -v"))"
RHOME=$(ssh "$HOST" 'echo $HOME')

echo "== files -> $HOST:~/studiodany"
ssh "$HOST" "mkdir -p ~/$DEST/tools ~/$DEST/.local/spotify ~/Library/LaunchAgents ~/Library/Logs"
scp -q tools/spotify-broker.js "$HOST:$DEST/tools/"
for f in config.json tokens.json device.json; do [ -f ".local/spotify/$f" ] && scp -q ".local/spotify/$f" "$HOST:$DEST/.local/spotify/"; done
ssh "$HOST" "chmod 700 ~/$DEST/.local ~/$DEST/.local/spotify; chmod 600 ~/$DEST/.local/spotify/*.json"

echo "== LaunchAgent"
sed -e "s|__NODE__|$NODE|g" -e "s|__HOME__|$RHOME|g" tools/com.studiodany.spotify-broker.plist | ssh "$HOST" 'cat > ~/Library/LaunchAgents/com.studiodany.spotify-broker.plist'
ssh "$HOST" 'launchctl bootout gui/$(id -u)/com.studiodany.spotify-broker 2>/dev/null || true; launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.studiodany.spotify-broker.plist; launchctl kickstart -k gui/$(id -u)/com.studiodany.spotify-broker'
sleep 3
echo "== status"
curl -s -m 5 "http://${HOST#*@}:8899/status"; echo
ssh "$HOST" 'tail -3 ~/Library/Logs/studiodany-spotify-broker.log'
