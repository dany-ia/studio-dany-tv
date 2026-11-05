# Phone-camera watcher

Lets the agent see the real TV through your phone. LAN only, HTTPS, no tunnel.

## Start / stop
```bash
python3 watcher/phonecam.py start          # generates a local CA + cert on first run, prints the pairing link
python3 watcher/phonecam.py newpair        # fresh single-use link (30 min), QR at .local/watcher/pair-qr.png
python3 watcher/phonecam.py stop           # revokes sessions, deletes frames and pairing state
```
Then `open .local/watcher/pair-qr.png` and scan it with the phone.

## Security model
- Pairing link: random token, single use, 30 minute expiry, exchanged for a session cookie
  (`Secure; HttpOnly; SameSite=Strict`, 6 h). Tokens are stored hashed, never logged.
- `/frame` and `/stop` require the session. `/status` and `/latest.jpg` answer only to 127.0.0.1.
- Only the last 3 frames are kept, under `.local/watcher/frames/` (git-ignored). `stop` deletes them.
- Nothing is exposed outside the LAN. Do not port-forward 8443.

## Certificate on the phone
The server uses a cert signed by a local CA in `.local/watcher/certs/`. Two options:
1. **Trust the CA once (recommended):** on the phone open `http://<mac-ip>:8444/ca.crt`.
   iPhone: Settings > Profile Downloaded > Install, then Settings > General > About >
   Certificate Trust Settings > enable "Studio Dany Watcher Local CA". After that the pairing
   page loads with no warning. Remove it the same way when done.
2. **Proceed past the warning:** Safari "Show details > visit this website". Camera still works
   because the origin is https, but Safari shows "Not secure".

## Agent loop
```bash
M=$(python3 watcher/watch.py mark)                       # before an action
# ... press a key / install an app ...
python3 watcher/watch.py wait --after "$M" --settle 2    # blocks until a frame captured after the action
python3 watcher/watch.py save .local/evidence/step.jpg   # keep selected evidence (outside git)
```
`wait` uses server receipt time, so a late upload of an old capture never counts as new state.
