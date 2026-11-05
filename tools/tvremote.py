#!/usr/bin/env python3
"""
Network remote control for the Samsung TV (Tizen WebSocket remote API, port 8002, token auth).
LAN only. The token lives in .local/tv-token.txt (git-ignored). Run with .local/venv/bin/python.

  tvremote.py pair                 -> first connection; accept the "Allow" prompt on the TV
  tvremote.py key KEY_HOME [KEY_RETURN ...] [--delay 0.6]
  tvremote.py info                 -> device info (REST 8001)
  tvremote.py app <app-id>         -> install/running state of an app (REST)
  tvremote.py launch <app-id>      -> launch an installed app over the remote channel
  tvremote.py power                -> toggle power (standby / wake) via KEY_POWER; wakes with WOL if needed
  tvremote.py wol                  -> Wake-on-LAN magic packet (needs TV_MAC in .local/tv.env)
Common keys: KEY_HOME KEY_RETURN KEY_ENTER KEY_UP KEY_DOWN KEY_LEFT KEY_RIGHT KEY_MENU KEY_POWER
             KEY_PLAY KEY_PAUSE KEY_VOLUP KEY_VOLDOWN KEY_MUTE KEY_RED KEY_0..KEY_9 KEY_EXIT
"""
import json, os, socket, sys, time, urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ENV = REPO / ".local" / "tv.env"
TOKEN = REPO / ".local" / "tv-token.txt"

def env():
    d = {}
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1); d[k.strip()] = v.strip()
    return d

def tv_ip():
    ip = env().get("TV_IP") or os.environ.get("TV_IP")
    if not ip: sys.exit("set TV_IP in .local/tv.env")
    return ip

def rest(path):
    with urllib.request.urlopen(f"http://{tv_ip()}:8001/api/v2/{path}", timeout=4) as r:
        return json.loads(r.read())

def connect():
    from samsungtvws import SamsungTVWS
    return SamsungTVWS(host=tv_ip(), port=8002, token_file=str(TOKEN), name="StudioDany Mac", timeout=12)

def cmd_pair():
    tv = connect()
    tv.open()
    tv.close()
    print("paired; token stored at", TOKEN)

def cmd_key(keys, delay):
    tv = connect()
    for k in keys:
        tv.send_key(k); time.sleep(delay)
    tv.close(); print("sent", " ".join(keys))

def cmd_launch(app_id):
    tv = connect(); tv.run_app(app_id); tv.close(); print("launch requested", app_id)

def cmd_wol():
    mac = env().get("TV_MAC")
    if not mac: sys.exit("set TV_MAC in .local/tv.env")
    raw = bytes.fromhex(mac.replace(":", ""))
    pkt = b"\xff" * 6 + raw * 16
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    s.sendto(pkt, ("255.255.255.255", 9)); s.close(); print("WOL sent")

def is_on():
    try: return rest("")["device"]["PowerState"] == "on"
    except Exception: return False

def cmd_power():
    if is_on():
        cmd_key(["KEY_POWER"], 0.3); print("standby requested")
    else:
        cmd_wol()
        try: cmd_key(["KEY_POWER"], 0.3)
        except Exception as e: print("ws power failed (normal in deep standby):", e)
        for _ in range(40):
            time.sleep(1)
            if is_on(): print("TV is on"); return
        print("TV did not report on within 40 s")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(1)
    if a[0] == "pair": cmd_pair()
    elif a[0] == "key":
        delay = 0.6
        if "--delay" in a: i = a.index("--delay"); delay = float(a[i + 1]); del a[i:i + 2]
        cmd_key(a[1:], delay)
    elif a[0] == "info": print(json.dumps(rest("")["device"], indent=1, ensure_ascii=False))
    elif a[0] == "app": print(json.dumps(rest("applications/" + a[1]), ensure_ascii=False))
    elif a[0] == "launch": cmd_launch(a[1])
    elif a[0] == "power": cmd_power()
    elif a[0] == "wol": cmd_wol()
    else: print(__doc__); sys.exit(1)
