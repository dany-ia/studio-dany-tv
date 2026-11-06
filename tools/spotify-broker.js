#!/usr/bin/env node
/* Spotify token broker for Studio Dany TV. Node, no dependencies, LAN only.

   The TV cannot do OAuth comfortably, so this tiny service on the Mac (later: the Mac Studio) does the
   Authorization Code + PKCE dance once, keeps the refresh token in an untracked file, and hands
   short-lived access tokens to the TV app.

   Ports:  127.0.0.1:8888  /login, /callback          (loopback only: the OAuth dance in your browser)
           0.0.0.0:8899    /token, /devices, /status   (LAN only: private source addresses, X-App-Key)

   Config  .local/spotify/config.json  { "client_id": "...", "app_key": "..." }
           (allow_ips is no longer used: the TV's IP can change, the app key is the credential)
   Tokens  .local/spotify/tokens.json  (refresh token; chmod 600; never committed)

   Usage:  node tools/spotify-broker.js            # start (keep it running: launchd/pm2 later)
           node tools/spotify-broker.js --login     # print the login URL (and open it)
*/
"use strict";
const http = require("http"), https = require("https"), fs = require("fs"), path = require("path"), crypto = require("crypto"), { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, ".."), DIR = path.join(ROOT, ".local", "spotify");
const CONFIG = path.join(DIR, "config.json"), TOKENS = path.join(DIR, "tokens.json");
const REDIRECT = "http://127.0.0.1:8888/callback";
const SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private";

fs.mkdirSync(DIR, { recursive: true });
const cfg = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, "utf8")) : {};
if (!cfg.client_id) { console.error("missing client_id in " + CONFIG + "  (create an app at https://developer.spotify.com/dashboard with redirect URI " + REDIRECT + ")"); process.exit(1); }
if (!cfg.app_key) { cfg.app_key = crypto.randomBytes(16).toString("hex"); fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2)); }
// LAN only: the server binds every interface but answers private (RFC 1918 / loopback / link-local) sources only
function isLan(ip) {
  ip = (ip || "").replace(/^::ffff:/, "");
  return ip === "::1" || /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || /^fe80:/i.test(ip) || /^f[cd]/i.test(ip);
}

let tokens = fs.existsSync(TOKENS) ? JSON.parse(fs.readFileSync(TOKENS, "utf8")) : null;   // {refresh_token, access_token, expires_at}
function saveTokens() { fs.writeFileSync(TOKENS, JSON.stringify(tokens, null, 2), { mode: 0o600 }); }

function post(url, form, headers) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString(), u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: "POST", headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) }, headers || {}) },
      res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(d || "{}") }); } catch (e) { resolve({ status: res.statusCode, json: { raw: d } }); } }); });
    req.on("error", reject); req.end(body);
  });
}
function api(method, p, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: "api.spotify.com", path: "/v1" + p, method, headers: Object.assign({ Authorization: "Bearer " + token }, data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}) },
      res => { let d = ""; res.on("data", c => d += c); res.on("end", () => { let j = null; try { j = d ? JSON.parse(d) : null; } catch (e) { j = { raw: d }; } resolve({ status: res.statusCode, json: j }); }); });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}

// ---- PKCE login ----
let pending = null;   // {verifier, state}
function loginUrl() {
  const verifier = crypto.randomBytes(48).toString("base64url"), challenge = crypto.createHash("sha256").update(verifier).digest("base64url"), state = crypto.randomBytes(8).toString("hex");
  pending = { verifier, state };
  const q = new URLSearchParams({ client_id: cfg.client_id, response_type: "code", redirect_uri: REDIRECT, scope: SCOPES, code_challenge_method: "S256", code_challenge: challenge, state });
  return "https://accounts.spotify.com/authorize?" + q.toString();
}
async function exchange(code) {
  const r = await post("https://accounts.spotify.com/api/token", { client_id: cfg.client_id, grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: pending.verifier });
  if (r.status !== 200) throw new Error("token exchange failed: " + JSON.stringify(r.json));
  tokens = { refresh_token: r.json.refresh_token, access_token: r.json.access_token, expires_at: Date.now() + (r.json.expires_in - 60) * 1000 }; saveTokens();
}
async function accessToken() {
  if (!tokens) throw new Error("not logged in");
  if (Date.now() < tokens.expires_at) return tokens.access_token;
  const r = await post("https://accounts.spotify.com/api/token", { client_id: cfg.client_id, grant_type: "refresh_token", refresh_token: tokens.refresh_token });
  if (r.status !== 200) throw new Error("refresh failed: " + JSON.stringify(r.json));
  tokens.access_token = r.json.access_token; tokens.expires_at = Date.now() + (r.json.expires_in - 60) * 1000;
  if (r.json.refresh_token) tokens.refresh_token = r.json.refresh_token; saveTokens();
  return tokens.access_token;
}

// ---- loopback server: the OAuth dance ----
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:8888");
  if (u.pathname === "/login") { res.writeHead(302, { Location: loginUrl() }); return res.end(); }
  if (u.pathname === "/callback") {
    try {
      if (!pending || u.searchParams.get("state") !== pending.state) throw new Error("state mismatch");
      if (u.searchParams.get("error")) throw new Error(u.searchParams.get("error"));
      await exchange(u.searchParams.get("code")); pending = null;
      res.writeHead(200, { "Content-Type": "text/html" }); res.end("<h2>Spotify conectado. Puedes cerrar esta pestaña.</h2>");
      console.log("login ok: refresh token stored in " + TOKENS);
    } catch (e) { res.writeHead(400, { "Content-Type": "text/plain" }); res.end("login failed: " + e.message); console.error(e.message); }
    return;
  }
  res.writeHead(404); res.end();
}).listen(8888, "127.0.0.1");

// ---- LAN server: tokens for the TV, helpers for the operator ----
http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress, u = new URL(req.url, "http://x");
  const send = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify(obj)); };
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "X-App-Key", "Access-Control-Max-Age": "600" }); return res.end(); }
  if (!isLan(ip)) { res.writeHead(403); return res.end(); }
  // /status needs no key: it is the discovery beacon (the TV probes it by mDNS name, cached IP, or a subnet scan)
  if (u.pathname === "/status") return send(200, { broker: "studiodany", logged_in: !!tokens, client: ip, host: req.headers.host || "" });
  if (req.headers["x-app-key"] !== cfg.app_key) return send(403, { error: "forbidden" });
  try {
    const t = await accessToken();
    if (u.pathname === "/token") { console.log(new Date().toISOString().slice(11, 19) + " token -> " + ip + " via " + (req.headers.host || "?")); return send(200, { access_token: t, expires_in: Math.floor((tokens.expires_at - Date.now()) / 1000) }); }
    if (u.pathname === "/devices") { const r = await api("GET", "/me/player/devices", t); return send(r.status, r.json); }
    return send(404, { error: "not found" });
  } catch (e) { return send(503, { error: e.message }); }
}).listen(8899, "0.0.0.0");

console.log("spotify broker: login at http://127.0.0.1:8888/login  ·  LAN token endpoint :8899 (private sources + X-App-Key)  ·  logged_in=" + !!tokens);
if (process.argv.includes("--login")) { const url = loginUrl(); console.log(url); execFile("open", [url]); }
