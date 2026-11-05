#!/usr/bin/env python3
"""
Studio Dany TV — private phone-camera watcher.

Turns a phone into a camera pointed at the TV so the agent can see the real
screen. LAN only, HTTPS with a locally generated CA, single-use pairing token,
scoped session cookie, no public tunnel. Stdlib only.

Usage:
  python3 watcher/phonecam.py start [--port 8443] [--host-ip 192.168.0.19]
      Generates certs on first run, starts the server, prints/opens the pairing QR.
  python3 watcher/phonecam.py newpair
      Issues a fresh single-use pairing link while the server runs (writes to .local/watcher/pair.txt).
  python3 watcher/phonecam.py stop
      Stops a running server (reads .local/watcher/server.pid).

Data lives under <repo>/.local/watcher/ (git-ignored): certs, frames, pid, pairing state.
"""
import argparse, base64, hashlib, http.server, json, os, secrets, signal, socket, ssl, subprocess, sys, threading, time
from pathlib import Path
from urllib.parse import urlparse, parse_qs

REPO = Path(__file__).resolve().parent.parent
STATE = REPO / ".local" / "watcher"
CERTS = STATE / "certs"
FRAMES = STATE / "frames"
RING = 3                      # keep the last N frames
PAIR_TTL = 1800               # pairing link valid 30 minutes, single use
SESSION_TTL = 6 * 3600        # camera session valid 6 hours

# ----------------------------------------------------------------------------- certs

def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80)); return s.getsockname()[0]
    finally:
        s.close()

def ensure_certs(host_ip):
    CERTS.mkdir(parents=True, exist_ok=True)
    ca_key, ca_crt = CERTS / "ca.key", CERTS / "ca.crt"
    srv_key, srv_crt, srv_csr = CERTS / "server.key", CERTS / "server.crt", CERTS / "server.csr"
    hostname = socket.gethostname()
    if not hostname.endswith(".local"): hostname += ".local"
    san = f"IP:{host_ip},IP:127.0.0.1,DNS:localhost,DNS:{hostname}"
    marker = CERTS / "san.txt"
    if srv_crt.exists() and marker.exists() and marker.read_text().strip() == san:
        return srv_crt, srv_key, ca_crt
    def run(*a): subprocess.run(a, check=True, capture_output=True)
    if not ca_crt.exists():
        run("openssl", "req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256", "-days", "3650",
            "-keyout", str(ca_key), "-out", str(ca_crt),
            "-subj", "/CN=Studio Dany Watcher Local CA/O=studio-dany-tv",
            "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign")
        os.chmod(ca_key, 0o600)
    ext = CERTS / "server.ext"
    ext.write_text(f"basicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName={san}\n")
    run("openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes", "-sha256", "-keyout", str(srv_key), "-out", str(srv_csr),
        "-subj", f"/CN={host_ip}/O=studio-dany-tv")
    run("openssl", "x509", "-req", "-in", str(srv_csr), "-CA", str(ca_crt), "-CAkey", str(ca_key), "-CAcreateserial",
        "-out", str(srv_crt), "-days", "820", "-sha256", "-extfile", str(ext))
    os.chmod(srv_key, 0o600); marker.write_text(san)
    return srv_crt, srv_key, ca_crt

# ----------------------------------------------------------------------------- state

class Store:
    def __init__(self):
        self.lock = threading.Lock()
        self.pair_tokens = {}      # sha256(token) -> expiry
        self.sessions = {}         # sha256(cookie) -> {"exp":..., "created":...}
        self.seq_server = 0
        self.latest = None         # meta dict
        FRAMES.mkdir(parents=True, exist_ok=True)
        STATE.mkdir(parents=True, exist_ok=True)
        self.load_pairs()

    def load_pairs(self):
        p = STATE / "pair-tokens.json"
        if p.exists():
            try:
                for h, exp in json.loads(p.read_text()).items():
                    if exp > time.time(): self.pair_tokens[h] = exp
            except Exception: pass
            p.unlink(missing_ok=True)

    @staticmethod
    def h(s): return hashlib.sha256(s.encode()).hexdigest()

    def new_pair_token(self):
        tok = secrets.token_urlsafe(24)
        with self.lock: self.pair_tokens[self.h(tok)] = time.time() + PAIR_TTL
        return tok

    def redeem(self, tok):
        with self.lock:
            exp = self.pair_tokens.pop(self.h(tok), None)
            if not exp or exp < time.time(): return None
            cookie = secrets.token_urlsafe(32)
            self.sessions[self.h(cookie)] = {"exp": time.time() + SESSION_TTL, "created": time.time()}
            return cookie

    def valid(self, cookie):
        if not cookie: return False
        with self.lock:
            s = self.sessions.get(self.h(cookie))
            return bool(s and s["exp"] > time.time())

    def revoke(self, cookie):
        with self.lock: self.sessions.pop(self.h(cookie), None)

    def revoke_all(self):
        with self.lock: self.sessions.clear(); self.pair_tokens.clear()

    def save_frame(self, data, phone_meta):
        with self.lock:
            self.seq_server += 1
            seq = self.seq_server
            now = time.time()
            path = FRAMES / f"frame-{seq % RING}.jpg"
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(data); os.replace(tmp, path)
            meta = {"server_seq": seq, "received_at": now, "path": str(path), "bytes": len(data), **phone_meta}
            self.latest = meta
            latest = FRAMES / "latest.json"; tmpj = latest.with_suffix(".tmp")
            tmpj.write_text(json.dumps(meta)); os.replace(tmpj, latest)
            # stable symlink/copy for convenience
            lj = FRAMES / "latest.jpg"
            try:
                if lj.is_symlink() or lj.exists(): lj.unlink()
                os.symlink(path.name, lj)
            except OSError:
                lj.write_bytes(data)
            return meta

STORE = Store()

# ----------------------------------------------------------------------------- pages

CAM_HTML = r"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Watcher · Studio Dany TV</title>
<style>
body{margin:0;background:#0b0d14;color:#e8eefc;font:16px -apple-system,system-ui,sans-serif;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}
h1{font-size:18px;margin:16px 0 8px;letter-spacing:.5px}
video{width:100%;max-height:52vh;background:#000;border-radius:12px;display:block}
.row{display:flex;gap:10px;margin:12px 0;flex-wrap:wrap}
button{flex:1;min-width:120px;padding:14px;border:0;border-radius:12px;font-size:16px;font-weight:600;color:#fff;background:#3b4a6b}
button.go{background:#2f9e5f}button.stop{background:#b3382f}button.sel{background:#6c4bd8}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#161a26;font-size:14px}
.dot{width:10px;height:10px;border-radius:50%;background:#555}.dot.on{background:#39d98a;box-shadow:0 0 10px #39d98a}
.dot.warn{background:#ffb347}
#log{font:13px ui-monospace,monospace;color:#9fb3d9;white-space:pre-wrap;margin-top:10px}
small{color:#8a97b8}
</style></head><body>
<h1>📷 Watcher · apunta la cámara trasera a la TV</h1>
<video id="v" autoplay playsinline muted></video>
<div class="row">
 <button id="start" class="go">Iniciar cámara</button>
 <button id="stop" class="stop" disabled>Detener cámara</button>
</div>
<div class="row">
 <button id="q" class="sel">Nitidez: normal</button>
 <button id="flip">Girar cámara</button>
 <button id="end">Cerrar sesión</button>
</div>
<div class="row">
 <span class="pill"><span id="dot" class="dot"></span><span id="state">inactiva</span></span>
 <span class="pill" id="last">sin envíos</span>
</div>
<small>Mantén esta página abierta y la pantalla encendida. Se envía una foto cada ~3 s, solo video, sin audio.</small>
<div id="log"></div>
<canvas id="c" hidden></canvas>
<script>
const v=document.getElementById('v'),c=document.getElementById('c'),log=m=>{const l=document.getElementById('log');l.textContent=(new Date().toLocaleTimeString()+' '+m+'\n'+l.textContent).slice(0,1500)};
const dot=document.getElementById('dot'),state=document.getElementById('state'),last=document.getElementById('last');
let stream=null,timer=null,seq=0,inflight=false,sharp=false,facing='environment',wakeLock=null,stopped=true;
const PERIOD=3000;
function setState(s,cls){state.textContent=s;dot.className='dot '+(cls||'')}
async function start(){
  try{
    const cons={video:{facingMode:{ideal:facing},width:{ideal:sharp?1920:1280},height:{ideal:sharp?1080:720}},audio:false};
    stream=await navigator.mediaDevices.getUserMedia(cons);
    v.srcObject=stream;await v.play();stopped=false;
    document.getElementById('start').disabled=true;document.getElementById('stop').disabled=false;
    setState('activa',"on");log('cámara iniciada');
    try{wakeLock=await navigator.wakeLock?.request('screen');wakeLock?.addEventListener('release',()=>log('wake lock liberado'));}catch(e){log('sin wake lock: '+e.message)}
    timer=setInterval(tick,PERIOD);setTimeout(tick,600);
  }catch(e){setState('error cámara','warn');log('getUserMedia: '+e.name+' '+e.message)}
}
function stopCam(revoke){
  stopped=true;clearInterval(timer);timer=null;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  v.srcObject=null;try{wakeLock?.release()}catch(e){}
  document.getElementById('start').disabled=false;document.getElementById('stop').disabled=true;
  setState('inactiva');log('cámara detenida');
  if(revoke)fetch('/stop',{method:'POST'}).then(()=>{log('sesión cerrada');document.body.innerHTML='<h1>Sesión cerrada. Puedes cerrar esta pestaña.</h1>'});
}
async function tick(){
  if(stopped||inflight||document.hidden||!v.videoWidth)return;
  inflight=true;
  try{
    c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',sharp?0.85:0.7));
    seq++;
    const r=await fetch('/frame',{method:'POST',body:blob,headers:{'Content-Type':'image/jpeg','X-Frame-Seq':String(seq),'X-Captured-At':String(Date.now()),'X-Frame-Size':c.width+'x'+c.height,'X-Sharp':sharp?'1':'0'}});
    if(r.status===401){setState('sesión expirada','warn');stopCam(false);log('401: pide un nuevo QR');return}
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();last.textContent='último envío #'+j.server_seq+' · '+c.width+'x'+c.height+' · '+Math.round(blob.size/1024)+' KB';setState('activa','on');
  }catch(e){setState('error de envío','warn');log('upload: '+e.message)}
  finally{inflight=false}
}
document.getElementById('start').onclick=start;
document.getElementById('stop').onclick=()=>stopCam(false);
document.getElementById('end').onclick=()=>stopCam(true);
document.getElementById('q').onclick=e=>{sharp=!sharp;e.target.textContent='Nitidez: '+(sharp?'alta':'normal');if(stream){stopCam(false);start()}};
document.getElementById('flip').onclick=()=>{facing=facing==='environment'?'user':'environment';if(stream){stopCam(false);start()}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){setState('en segundo plano','warn');log('página oculta: pausado')}else if(stream){setState('activa','on');if(!wakeLock||wakeLock.released)navigator.wakeLock?.request('screen').then(w=>wakeLock=w).catch(()=>{})}});
if(!navigator.mediaDevices?.getUserMedia){setState('sin getUserMedia','warn');log('isSecureContext='+window.isSecureContext)}
</script></body></html>"""

LANDING_HTML = """<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;background:#0b0d14;color:#e8eefc;padding:24px"><h2>Studio Dany TV watcher</h2>
<p>Este enlace de emparejamiento no es válido o ya expiró. Pide un QR nuevo.</p></body>"""

# ----------------------------------------------------------------------------- handler

class H(http.server.BaseHTTPRequestHandler):
    server_version = "watcher/1.0"
    def log_message(self, fmt, *args):  # never log query strings (tokens)
        path = self.path.split("?")[0]
        sys.stderr.write(f"{time.strftime('%H:%M:%S')} {self.client_address[0]} {self.command} {path} \n")

    def cookie(self):
        c = self.headers.get("Cookie", "")
        for part in c.split(";"):
            k, _, val = part.strip().partition("=")
            if k == "ws": return val
        return None

    def send(self, code, body=b"", ctype="text/html; charset=utf-8", extra=None):
        if isinstance(body, str): body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store"); self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)

    def is_local(self): return self.client_address[0] in ("127.0.0.1", "::1")

    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/pair":
            if STORE.valid(self.cookie()):   # already paired on this phone: just go to the camera page
                return self.send(303, "", extra={"Location": "/cam"})
            tok = (q.get("t") or [""])[0]
            cookie = STORE.redeem(tok)
            if not cookie: return self.send(403, LANDING_HTML)
            self.send(303, "", extra={"Location": "/cam", "Set-Cookie": f"ws={cookie}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}"})
            sys.stderr.write("pairing redeemed -> session created\n"); return
        if u.path == "/cam":
            if not STORE.valid(self.cookie()): return self.send(403, LANDING_HTML)
            return self.send(200, CAM_HTML)
        if u.path == "/ca.crt":   # the local CA, so the phone can trust it (optional)
            ca = CERTS / "ca.crt"
            return self.send(200, ca.read_bytes(), "application/x-x509-ca-cert", {"Content-Disposition": 'attachment; filename="studio-dany-watcher-ca.crt"'})
        if u.path == "/status" and self.is_local():
            return self.send(200, json.dumps({"latest": STORE.latest, "now": time.time(), "sessions": len(STORE.sessions)}), "application/json")
        if u.path == "/latest.jpg" and self.is_local():
            m = STORE.latest
            if not m: return self.send(404, "no frame yet", "text/plain")
            return self.send(200, Path(m["path"]).read_bytes(), "image/jpeg")
        if u.path == "/healthz": return self.send(200, "ok", "text/plain")
        return self.send(404, LANDING_HTML)

    def do_POST(self):
        u = urlparse(self.path)
        if not STORE.valid(self.cookie()): return self.send(401, "{}", "application/json")
        if u.path == "/frame":
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > 6_000_000: return self.send(413, "{}", "application/json")
            data = self.rfile.read(n)
            if not data.startswith(b"\xff\xd8"): return self.send(400, "{}", "application/json")
            meta = {"phone_seq": int(self.headers.get("X-Frame-Seq", "0") or 0),
                    "captured_at_phone_ms": int(self.headers.get("X-Captured-At", "0") or 0),
                    "size": self.headers.get("X-Frame-Size", ""), "sharp": self.headers.get("X-Sharp") == "1"}
            m = STORE.save_frame(data, meta)
            return self.send(200, json.dumps({"server_seq": m["server_seq"]}), "application/json")
        if u.path == "/stop":
            STORE.revoke(self.cookie()); return self.send(200, "{}", "application/json")
        return self.send(404, "{}", "application/json")

# ----------------------------------------------------------------------------- commands

def write_pair(host_ip, port):
    tok = STORE.new_pair_token()
    url = f"https://{host_ip}:{port}/pair?t={tok}"
    (STATE / "pair.txt").write_text(url + "\n"); os.chmod(STATE / "pair.txt", 0o600)
    png = STATE / "pair-qr.png"
    try:
        subprocess.run(["qrencode", "-o", str(png), "-s", "10", "-m", "2", url], check=True, capture_output=True)
    except Exception:
        png = None
    return url, png

def cmd_start(a):
    host_ip = a.host_ip or lan_ip()
    crt, key, ca = ensure_certs(host_ip)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(str(crt), str(key))
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", a.port), H)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    (STATE / "server.pid").write_text(str(os.getpid()))
    (STATE / "server.json").write_text(json.dumps({"host_ip": host_ip, "port": a.port, "started": time.time()}))
    url, png = write_pair(host_ip, a.port)
    sys.stderr.write(f"watcher listening on https://{host_ip}:{a.port}  (pid {os.getpid()})\n")
    sys.stderr.write(f"pairing link written to {STATE/'pair.txt'}" + (f", QR at {png}\n" if png else "\n"))
    sys.stderr.write(f"CA cert (optional trust): http://{host_ip}:{a.port+1}/ca.crt\n")
    # tiny plain-HTTP helper that serves ONLY the CA cert (so iOS can install the profile)
    class CA(http.server.BaseHTTPRequestHandler):
        def log_message(self, *x): pass
        def do_GET(self):
            if self.path != "/ca.crt": self.send_response(404); self.end_headers(); return
            b = ca.read_bytes(); self.send_response(200)
            self.send_header("Content-Type", "application/x-x509-ca-cert"); self.send_header("Content-Length", str(len(b)))
            self.send_header("Content-Disposition", 'attachment; filename="studio-dany-watcher-ca.crt"'); self.end_headers(); self.wfile.write(b)
    ca_srv = http.server.ThreadingHTTPServer(("0.0.0.0", a.port + 1), CA)
    threading.Thread(target=ca_srv.serve_forever, daemon=True).start()
    def newpair(sig, frm):
        u, p = write_pair(host_ip, a.port); sys.stderr.write("new pairing link issued\n")
    signal.signal(signal.SIGUSR1, newpair)
    def stop(sig, frm):
        sys.stderr.write("shutting down, revoking sessions\n"); STORE.revoke_all()
        for f in FRAMES.glob("*"):
            try: f.unlink()
            except OSError: pass
        for f in ("server.pid", "server.json", "pair.txt", "pair-qr.png"):
            (STATE / f).unlink(missing_ok=True)
        os._exit(0)
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    srv.serve_forever()

def running_pid():
    p = STATE / "server.pid"
    if not p.exists(): return None
    pid = int(p.read_text().strip() or 0)
    try: os.kill(pid, 0); return pid
    except OSError: return None

def cmd_newpair(a):
    pid = running_pid()
    if not pid: sys.exit("watcher not running")
    (STATE / "pair.txt").unlink(missing_ok=True)
    os.kill(pid, signal.SIGUSR1)
    for _ in range(50):
        if (STATE / "pair.txt").exists(): break
        time.sleep(0.1)
    print((STATE / "pair.txt").read_text().strip()); print("QR:", STATE / "pair-qr.png")

def cmd_stop(a):
    pid = running_pid()
    if not pid: print("watcher not running"); return
    os.kill(pid, signal.SIGTERM); time.sleep(0.5); print("stopped", pid)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    s = sp.add_parser("start"); s.add_argument("--port", type=int, default=8443); s.add_argument("--host-ip"); s.set_defaults(f=cmd_start)
    sp.add_parser("newpair").set_defaults(f=cmd_newpair)
    sp.add_parser("stop").set_defaults(f=cmd_stop)
    a = ap.parse_args(); a.f(a)
