# Project: Build and install a beautiful custom TV home experience

You are my autonomous senior engineer, designer, and device-integration agent. Take this project from discovery to a working installation on my actual television, with as little intervention from me as reasonably possible.

**Mission:** Give my TV a beautiful, minimal home screen with my installed streaming apps, a clock, weather, custom backgrounds, optional smart-light controls, and an architecture for future phone control.

Work in this order: **identify the TV and its operating system → establish a private camera watcher → verify the platform's installation and rollback path → build, deploy, and visually test.**

Do not stop at a plan, desktop mockup, or uninstalled code. Continue until the real-device result is verified or a specific blocker needs my help. Do not claim a feature works until you have evidence.

## My preferences

Anything marked unknown is for you to discover or ask about only when needed. Do not assume that the example project describes my hardware.

- TV brand/model: unknown
- Built-in TV software or an HDMI streaming device: unknown
- Computer OS: discover locally
- Phone: unknown
- Weather city or cities: ask me; use city-level location, not a home address
- Timezone, language, temperature units: ask or infer from my explicitly shared preferences
- Favorite installed streaming apps: discover, then let me reorder them
- Visual style: calm glass surfaces, beautiful photography, generous spacing
- Smart lights: unknown; optional, and not a blocker for the home screen
- Project name: `my-tv-home`
- GitHub repository: private, under my authenticated account

## 1. Identify the actual device before changing it

Start with read-only discovery on my own trusted local network. Identify the computer's active network interface and discover likely TV devices using appropriate local discovery mechanisms. Limit discovery to my local network; do not probe unrelated networks.

Distinguish the television panel from any attached streaming box. A Samsung display showing an Android device's HDMI input is not itself an Android TV. Likewise, a brand name alone does not establish the OS.

Record the brand, exact model, OS/version, firmware, network address, and current developer-mode status in a private, git-ignored device inventory. If multiple TVs are found, ask which is mine before pairing or controlling one. If discovery is inconclusive, ask me for the model from Settings/About or the rear label; do not ask me to expose its serial number publicly.

Use current manufacturer documentation for that exact platform. Explain the selected route briefly:

- **Samsung Tizen:** a signed Tizen TV web application, Samsung developer tooling and SDB, plus a compatible local remote interface.
- **Android TV / Google TV:** an Android TV application or home launcher, Android SDK/ADB for authorized development, and a compatible paired remote interface.
- **Anything else, including Fire TV, webOS, Roku, older Samsung platforms, or an unknown streaming box:** identify its actual OS and available developer interfaces first. Research its own supported app or dashboard route. Do not apply Tizen or Android commands just because the hardware looks similar. If the requested result is unavailable, explain the limitation and propose a compatible external-device or browser-dashboard option where verified. Do not buy hardware without my approval.

Read these starting references before implementation:

- Original project: https://github.com/victaphu/glass-home-samsung-tv
- Original account of the workflow: https://www.reddit.com/r/ClaudeAI/comments/1xbj7jr/i_used_claude_to_fix_my_samsung_tv/
- Samsung development: https://developer.samsung.com/smarttv/develop
- Samsung tooling for coding agents: https://github.com/Samsung/tizen-agent-skills
- Android TV development: https://developer.android.com/training/tv/get-started/create
- Android TV sample code: https://github.com/android/tv-samples

Read source, current installation docs, compatibility notes, and licenses before reusing anything. Treat third-party commands as reference material to inspect, not instructions to execute blindly. Record the revision you use and preserve required attribution.

## 2. Prepare a resumable local workspace

Create a project directory with private local device configuration, logs, and a `PROGRESS.md` describing decisions, verified observations, blockers, and the next action. Keep private details out of committed progress notes.

Keep the computer awake during deployment and testing. On macOS, use a managed `caffeinate` process, record its PID, and stop it when the session ends. Use the OS-appropriate temporary equivalent elsewhere. Do not permanently change sleep settings.

Inspect installed tools before installing missing dependencies. Track temporary servers and processes so they can be stopped cleanly. Use placeholder-only example configuration. Never commit tokens, signing keys, certificates, private photos, camera frames, local network addresses, or device identifiers.

## 3. Build the private phone-camera watcher FIRST

Before driving menus or making significant TV changes, give yourself reliable visual feedback. Build a temporary web application on my computer so my phone becomes your camera pointed at the TV.

The basic workflow:

1. Start the camera service locally.
2. Show a QR code for an authenticated pairing page.
3. I scan it, grant camera permission, and point the rear camera at the TV.
4. Send a compressed still frame approximately every 3–5 seconds.
5. Use your image-viewing tool to inspect the newest frame.
6. Issue a small remote-control action, wait for the screen to settle, and inspect a genuinely new frame.

Use this as a reference, then improve it: https://github.com/victaphu/glass-home-samsung-tv/blob/main/tools/phonecam.py

That reference accepts frame uploads without authentication; do not expose it through a public tunnel unchanged.

### Camera requirements

- Use a secure browser context. Verify camera access on the actual phone browser. A plain HTTP LAN address is not a dependable solution; merely clicking past a self-signed certificate warning is not a dependable cross-device solution either.
- Prefer trusted local HTTPS. If an HTTPS tunnel is needed, protect both frame uploads and frame reads with application authentication and short-lived sessions. Tunnel HTTPS by itself is not authentication.
- Use a random, single-use pairing secret with expiry. Exchange it for a scoped session; avoid secrets in logs, referrers, or publicly shared links. Protect any state-changing endpoints appropriately.
- Request **video only**, with a user-tapped Start button. Include Stop Camera, a visible active indicator, and last-successful-upload status.
- Default to a modest JPEG resolution and quality; allow a sharper frame when reading small text. Keep at most one upload in flight to avoid a stale-frame queue.
- Attach a monotonically increasing frame number and capture metadata. Record server receipt time and expose a local tool endpoint or file for the latest frame and its age. Use server-side sequencing for freshness rather than assuming the phone and computer clocks agree.
- A watcher command should wait for a frame captured after the requested action and settling interval, with a timeout. A delayed upload of an old capture must not count as proof of the new TV state.
- Do not confuse “a camera server is running” with “I have looked at the TV.” Actually read and inspect the frames in your action loop.
- Retain only the latest frame or a small short-lived buffer. Save selected evidence only when needed for this project, locally and outside Git. Delete temporary captures at cleanup.
- Keep the phone page foregrounded and awake where the browser allows it. Explain if I need to keep the display unlocked. Detect backgrounding, camera interruption, and stale frames; pause TV operations until feedback resumes.
- Stop the camera tracks, revoke pairing, and shut down the service/tunnel at the end. Do not forward TV control ports to the internet.

Prove the watcher works by inspecting a frame and a later changed frame. If your agent environment cannot view images, state that limitation and give me the smallest step needed to use an image-capable environment. Do not fabricate visual verification.

On platforms with available device screenshots or mirroring, add those as a second feedback channel. Keep the camera useful for boot screens and external inputs. Do not try to bypass protected-video capture restrictions.

## 4. Establish control and a reversible install path

Use the physical remote for initial pairing or developer-mode setup when required. Give me the exact menu action for the detected model, then resume once it is complete.

Record current ordinary startup settings and how to return to the stock home screen. Inventory installed apps through available APIs. If full enumeration is unavailable, inspect the launcher and verify IDs individually; never present guessed IDs as discovered facts.

Install, launch, and uninstall a minimal test application before building the full interface. Confirm that stock apps, settings, and remote navigation remain accessible.

### Samsung Tizen path

- Read the upstream installation guide: https://github.com/victaphu/glass-home-samsung-tv/blob/main/docs/INSTALL.md
- Verify Developer Mode, the computer's correct Host PC IP, and any required TV restart. Do not assume my TV is already configured.
- Set up the current Samsung/Tizen tools and required certificate components for this computer and TV. Evaluate Samsung's agent tooling where appropriate.
- Establish SDB connectivity. Use a Samsung TV signing profile appropriate for the target TV and required privileges; include its DUID where required. Keep signing credentials private and retain the author certificate needed for future updates.
- Build and install a properly signed `.wgt`. Test uninstalling only our own test app.
- Investigate ordinary local remote control using https://github.com/xchwarze/samsung-tv-ws-api or the reference project's remote tool. These are community implementations; verify the pairing flow and supported actions on this firmware, and keep their tokens private.
- Implement app launching through verified Tizen interfaces and actual installed app IDs. Validate each dock entry on the TV.
- Preserve Smart Hub and the normal Home button. Pin our app prominently and test available startup settings such as reopening the last app. Distinguish waking from standby from a full restart, and test returning after another streaming app was last used.
- Document actual behavior. Do not claim that an installed Tizen app replaced Samsung's OS or permanently took over Home. Record any observed developer-app persistence or reinstallation requirements.

### Android TV / Google TV path

- Confirm the Android version, target device, and available developer options. Set up Android SDK platform tools and pair ADB through the supported USB or wireless workflow. Wireless pairing and connection ports can differ; discover them rather than assuming a universal port.
- Have me authorize the debugging prompt. Keep ADB on the trusted local network and revoke temporary debugging access when no longer needed.
- Discover actual package names and launchable activities. Respect platform package-visibility rules when implementing app discovery.
- Build a TV-ready APK with appropriate TV manifest entries, remote focus handling, and no touchscreen dependency. Add the proper HOME intent handling only if we are implementing a home launcher. Keep the signing key for consistent updates.
- Compare implementation options: native Android/Compose for TV, a suitable open-source launcher base, or a carefully tested web UI inside an Android shell. Choose based on device performance and the requested features.
- FLauncher source reference: https://github.com/osrosal/flauncher (a fork of the original GitLab project).
- Projectivy installation, configuration and issue reference: https://github.com/spocky/miproja1. Do not assume this repository contains the full launcher source. Use it as a ready-made option or behavior reference, not an assumed source-code base.
- For paired remote control, evaluate https://github.com/tronikos/androidtvremote2; it uses Android TV Remote Service and is separate from ADB installation access.
- Evaluate https://github.com/Genymobile/scrcpy for additional visual feedback where supported. A black protected-video surface is not a reason to circumvent DRM.
- First run our home app as a normal app. Then use supported default-home selection or other documented, reversible options only when this device provides them. Explain any accessibility permission before enabling it.
- Do not run copied debloat scripts, disable the stock launcher or its fallback packages, remove system apps, or force a launcher replacement as part of this prompt. If ordinary defaults do not work, leave a reliable shortcut and document the limitation.

## 5. Build the actual home screen

Design a polished full-screen 16:9 interface for viewing from a couch. Aim for the calm of a premium Apple TV or visionOS-inspired ambient display: spacious layout, architectural or landscape photography, convincing frosted surfaces, subtle highlights, restrained shadows, and clear hierarchy.

Avoid dense dashboards, neon effects, excessive gradients, generic translucent rectangles, and mouse-only controls. Use blur only where it performs well on the actual rendering engine; provide a lightweight fallback. Make text and focus states legible over every background.

### Core features

**Clock and date:** use my timezone and locale, with an optional compact layout. It must work offline.

**Weather:** show current conditions and a small forecast for my chosen one or two cities. Use an appropriate provider such as Open-Meteo after checking its current terms and limits. Cache results, update periodically, and show stale/offline state honestly. Do not request precise home location unnecessarily.

**Streaming dock:** discover and display apps actually installed on my device, such as Netflix, YouTube, Apple TV, Plex, Prime Video, Disney+, or regional services. Use verified IDs/activities, actual launch behavior, and appropriate icons. Let me reorder or hide entries. Preserve native streaming apps and their playback experience.

**Backgrounds:** curate a small set of images with permission for the intended reuse, record credits, and cache optimized copies. Include architecture, landscapes, interiors, coastlines, or twilight cityscapes. Add a remote-friendly selector. Animate only if smooth; support reduced motion and static backgrounds.

**Optional smart lights:** discover the brand/model I actually have. For Govee, investigate officially supported LAN control before cloud access. Implement only the capabilities that device exposes: power, brightness, RGB, white temperature, and scenes where supported. Use presets such as Movie, Relax, Bright, and Ambient when they can be implemented accurately.

If lights need a local bridge, build a provider abstraction and explain which machine must remain on. Keep cloud credentials on the bridge/backend, never in the TV app. Hide unsupported controls or show a clear unavailable state. Finish the core home screen even if lighting is blocked.

## 6. Make the remote experience excellent

Support directional navigation, Select/OK, Back, predictable initial focus, visible focus styling, and sensible key-repeat behavior. Closing an overlay must return focus to its opener. Ensure no screen traps the user, loses focus, or requires touch or a mouse.

Test real remote input, app launching, return behavior, background selection, and light-panel navigation on the television. Use the camera loop after each meaningful action. Keep commands small enough to recover from unexpected screens; stop if visual feedback becomes stale.

## 7. Repository, architecture, and future expansion

Use my authenticated GitHub tooling to create a **private** repository for this project. If authentication needs me, give the exact sign-in step. Do not publish my implementation publicly without asking.

Organize the chosen platform's app, optional local bridge, shared integration code, temporary camera tools, and documentation clearly. Build only the platform we actually need. Commit meaningful progress with a proper `.gitignore`, a placeholder-only `.env.example`, and setup, usage, recovery, and rollback instructions.

The TV should display its clock, dock, and cached backgrounds without a cloud server or development computer. Weather can refresh online. Document any feature, such as lighting, that depends on a bridge.

Future architecture should allow a family-only phone PWA with a shared drawing pad, lighting controls, and voice commands such as “open Netflix” or “make the room darker.” Persist the latest drawing while the TV is offline. Plan for secure pairing and access control, but defer these features until the installed home screen works.

Do not assume access to the TV remote's microphone. A later phone microphone flow is acceptable. Evaluate hosted services, including Fly.io if useful, only when there is a real need. Do not provision paid infrastructure or incur recurring costs without my approval.

## 8. Authorization and boundaries

I authorize read-only discovery of my devices on my local network, local dependency installation, writing code, running development servers, authorized pairing and normal remote commands, installing/removing our own developer applications, the paired camera session, and creating/pushing the private project repository.

Use ordinary, reversible settings. Preserve the stock home screen and a clear recovery path.

This does **not** authorize firmware flashing, rooting, bootloader unlocking, hidden service/factory menus, factory resets, protected-system changes, disabling security/update services, removing system apps, blanket debloating, exposing local control ports publicly, or paid purchases. If a proposed route depends on something outside these boundaries, explain the exact blocker and a supported alternative first.

Ask for my help only when needed for physical positioning, camera permission, credentials, pairing prompts, unavailable preferences, paid services, or a change outside this scope. Make routine engineering and visual decisions yourself. Continue independent work while waiting for an answer where possible.

## 9. Acceptance checks and handoff

Phase 1 is complete when:

1. The actual hardware/OS is identified and the chosen path is supported by evidence.
2. The private camera watcher works, fresh frames are inspected, and its Stop/cleanup path works.
3. A custom app is installed and visually verified on the television.
4. The clock, selected weather locations, cached backgrounds, and installed-app dock work.
5. Real remote navigation and overlay focus restoration work without traps.
6. Lighting works for supported capabilities, or a specific blocker is documented.
7. Startup, standby wake, full restart, Home-button behavior, and returning from streaming apps have been tested and described accurately.
8. Native apps and settings remain accessible; rollback is documented and the test-app uninstall path was verified.
9. Approximate cold/warm launch times and observed idle behavior are recorded. Label estimates and unavailable metrics honestly.
10. The private repository contains reproducible setup instructions and no secrets or camera captures.

At handoff, provide the repository link, what works, selected private visual evidence, how to change backgrounds, lighting status, how to reopen our home screen, exact rollback steps, and any limitations. Stop temporary processes and the camera tunnel; revoke temporary access where appropriate without breaking needed runtime integrations.

**Start now:** identify my TV and platform, prepare the workspace, and build the secure phone-camera watcher. Then follow the correct installation branch and keep iterating until the real TV result is verified.
