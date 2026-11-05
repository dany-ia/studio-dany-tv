#!/usr/bin/env python3
"""
Agent-side helper for the phone-camera watcher. Reads frames the server wrote
under .local/watcher/frames (no network needed).

  watch.py status                 -> latest frame meta + age in seconds
  watch.py mark                   -> prints a marker (server_seq + time) to use with `wait`
  watch.py wait --after <mark> [--settle 2] [--timeout 40] [--out path.jpg]
      Blocks until a frame RECEIVED after (mark_time + settle) exists, i.e. a
      genuinely new capture taken after the action. Prints its path (or copies to --out).
  watch.py save <path.jpg>        -> copy the latest frame as evidence (outside git)
"""
import json, shutil, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FRAMES = REPO / ".local" / "watcher" / "frames"
LATEST = FRAMES / "latest.json"

def latest():
    if not LATEST.exists(): return None
    try: return json.loads(LATEST.read_text())
    except Exception: return None

def status():
    m = latest()
    if not m: print(json.dumps({"ok": False, "reason": "no frame yet"})); return 1
    m["age_s"] = round(time.time() - m["received_at"], 1); m["ok"] = m["age_s"] < 12
    print(json.dumps(m)); return 0

def mark():
    m = latest(); print(json.dumps({"seq": m["server_seq"] if m else 0, "t": time.time()})); return 0

def wait(after, settle, timeout, out):
    mk = json.loads(after) if after.strip().startswith("{") else {"seq": int(after), "t": time.time()}
    deadline = time.time() + timeout; need_t = mk["t"] + settle
    while time.time() < deadline:
        m = latest()
        if m and m["server_seq"] > mk["seq"] and m["received_at"] >= need_t:
            # The phone captures right before uploading; received_at >= need_t means the
            # capture happened after the action settled (upload takes < 1 s on LAN).
            if out: shutil.copy(m["path"], out); m["saved_to"] = out
            m["age_s"] = round(time.time() - m["received_at"], 1); print(json.dumps(m)); return 0
        time.sleep(0.3)
    print(json.dumps({"ok": False, "reason": "timeout waiting for a fresh frame", "latest": latest()})); return 2

def save(path):
    m = latest()
    if not m: print("no frame"); return 1
    Path(path).parent.mkdir(parents=True, exist_ok=True); shutil.copy(m["path"], path); print(path); return 0

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] == "status": sys.exit(status())
    if a[0] == "mark": sys.exit(mark())
    if a[0] == "save": sys.exit(save(a[1]))
    if a[0] == "wait":
        import argparse; ap = argparse.ArgumentParser(); ap.add_argument("--after", required=True)
        ap.add_argument("--settle", type=float, default=2.0); ap.add_argument("--timeout", type=float, default=40)
        ap.add_argument("--out"); o = ap.parse_args(a[1:]); sys.exit(wait(o.after, o.settle, o.timeout, o.out))
    print(__doc__); sys.exit(1)
