# ⌨️ KeyVibe Studio

> **AI Touch Typing Studio with Realistic Hands Guidance, Mechanical Switch Acoustics & Voice Coaching**

KeyVibe Studio is a modern web application designed to help users master touch typing with finger-accurate spatial memory, organic dual-action mechanical switch sound effects, and zero-latency visual guidance.

---

## ✨ Features

### 🖐️ Realistic Dynamic Hand Overlay
- **Posture-Accurate Guidance**: Semi-translucent hands overlaid above the on-screen keyboard showing home-row resting posture and animated finger reaches.
- **Micro-Animations**: Real-time fingertip tap pulses, target key glowing halo rings, and smooth finger retraction.
- **Customization**: Fine-tune hand overlay transparency and finger thickness directly from the settings drawer.

### 🔊 Mechanical Sound Engine
- **Authentic Recorded Switch Profiles**:
  - **Creamy Thock (NovelKeys Cream)**: Deep, rich linear switch bottom-out clacks.
  - **Crisp Tactile (Cherry MX Blue)**: Crisp click leaf snap with tactile spring resonance.
  - **Vintage Typewriter**: Metallic typebar strike with carriage body echo.
  - **Quiet Chiclet / Membrane**: Soft, dampened laptop scissor-switch taps.
  - **Deep Linear (Cherry MX Black)**: Heavy linear solid keystrokes.
- **Public Voice Sample Mode**: Real spoken voice announcements for every letter, number, and key.
- **Multi-Sample Round-Robin**: Cycles through multiple distinct recordings per switch type to eliminate repetitive machine-gun effects.
- **Dual-Action Upstroke Return Clack**: Plays authentic mechanical key return clacks on `keyup` as switch stems reset.
- **Stabilizer Resonance**: Spacebar weighting with low-frequency desk acoustic pulse.
- **Procedural Acoustic Fallback**: Pure Web Audio API physical simulation fallbacks for offline zero-latency execution.

### ⌨️ Illuminated Virtual Keyboard
- **Chassis Themes**: Cyber Dark, Obsidian, Retro Cream, Matrix Green, Synthwave Neon, and Chalk White.
- **Ergonomic Tuning**: Adjustable keyboard width and keycap height.
- **Zen Mode**: Hide the virtual keyboard anytime (`Alt + K`) for blind touch typing practice.

### ⚡ Practice Modes & Learning Paths
- **Words Mode**: Timed or word-count sprint practice with top English frequencies.
- **Academy Curriculum**: 12 structured touch-typing lessons from Home Row fundamentals to top/bottom row numbers and advanced symbols.
- **Quotes Mode**: Famous historical and literature excerpts.
- **Custom Mode**: Practice any custom text, documentation, or code snippets.

### 📊 Real-Time Analytics & Coaching
- Live WPM, Net WPM, Accuracy, Streak counter, and second-by-second performance tracking.
- Per-finger accuracy and error heatmaps.
- AI Voice Coach (Text-to-Speech) providing spoken key guidance and error encouragement.

---

## 🚀 Quick Start

KeyVibe Studio is built entirely with vanilla Web Standards (HTML5, Vanilla CSS3, ES6 Modules, and the Web Audio API). There is **no complex build pipeline or bundler required**.

### Option 1: Python Dev Server (Recommended)
```bash
python server.py 3000
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 2: Windows Batch
Double-click `start-server.bat` in the project root.

### Option 3: Node / NPX
```bash
npx serve -p 3000 .
```

---

## 🌐 Production Deployment

KeyVibe is 100% static and ready for instant deployment to any cloud provider or CDN:

### Vercel
```bash
npx vercel --prod
```
*(Pre-configured with `vercel.json` for audio asset caching and HTTP security headers)*

### Netlify
```bash
npx netlify deploy --prod --dir .
```
*(Pre-configured with `netlify.toml` for immutable sound caching)*

### GitHub Pages
1. Push repository to GitHub.
2. In repository **Settings** → **Pages**, select branch `main` and root directory `/`.
3. Your studio is live within seconds!

### Docker / Nginx
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 📁 Project Directory Structure

```
.
├── css/
│   └── style.css                 # Core design tokens, layout & animations
├── js/
│   ├── app.js                    # Main application controller & state machine
│   ├── audio.js                  # Sample-based & procedural mechanical sound engine
│   ├── fingerMap.js              # Standard QWERTY finger assignment mappings
│   ├── handOverlay.js            # Realistic dynamic SVG hands posture coach
│   ├── hands.js                  # 2D hands indicator component
│   ├── keyboard.js               # Virtual illuminated mechanical keyboard
│   ├── lessons.js                # Academy lessons & practice text generator
│   └── tts.js                    # Text-to-Speech AI voice coach engine
├── sounds/                       # Mechanical switch & voice audio sample packs
│   ├── thock/                    # NovelKeys Cream recorded samples
│   ├── clicky/                   # Cherry MX Blue recorded samples
│   ├── typewriter/               # Vintage Typewriter recorded samples
│   ├── soft/                     # Chiclet / membrane recorded samples
│   ├── cherry_black/             # Cherry MX Black recorded samples
│   └── voice/                    # Public voice spoken key recordings (88 files)
├── depricated/                   # Historical 3D model assets & calibration studio
├── index.html                    # Main studio application page
├── manifest.json                 # PWA Web App Manifest
├── robots.txt                    # Search engine crawler instructions
├── sitemap.xml                   # Production sitemap
├── vercel.json                   # Vercel CDN caching & security configuration
├── netlify.toml                  # Netlify deployment rules
├── package.json                  # NPM project metadata & scripts
├── .gitignore                    # Production git ignore definitions
└── server.py                     # Multi-threaded development HTTP server
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + K` | Toggle Virtual Keyboard (Zen Mode) |
| `Esc` | Close Settings Drawer / Result Modal |
| `Tab` | Restart active practice test |
| `Shift + Click` Sound Icon | Mute / Unmute audio |

---

## 💻 Desktop Application (Windows & Linux)

KeyVibe is powered by **Tauri v2** to run natively as a high-performance Windows & Linux desktop application.

### 🚀 Running Locally

#### On Windows:
- **Option 1 (One-Click):** Double-click [run-desktop.bat](file:///c:/Dev/typing%20test/run-desktop.bat)
- **Option 2 (Terminal):**
  ```powershell
  npm run tauri:dev
  ```

#### On Linux:
  ```bash
  # Install prerequisites (Ubuntu / Debian):
  sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  npm run tauri:dev
  ```

### 📦 Building Native Installers

#### Windows (.exe installer & standalone binary):
- **Option 1 (One-Click):** Double-click [build-desktop.bat](file:///c:/Dev/typing%20test/build-desktop.bat)
- **Option 2 (Terminal):**
  ```powershell
  npm run tauri:build
  ```
  The compiled `.exe` and NSIS installer will be located in `src-tauri/target/release/`.

#### Linux (.deb package & .AppImage):
- Run the build script:
  ```bash
  bash scripts/build-linux.sh
  ```
  Packages are generated in `src-tauri/target/release/bundle/`.

#### Automated CI/CD (GitHub Actions):
Whenever code is pushed or tagged with a release tag (e.g. `v1.0.0`), [.github/workflows/desktop-release.yml](file:///c:/Dev/typing%20test/.github/workflows/desktop-release.yml) automatically builds native installers for **both Windows and Linux** and publishes them as downloadable release artifacts.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
