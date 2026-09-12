# ABYSS — The Blue 🌊

> An open-source atmospheric 3D underwater exploration experience built with Three.js, React 19, Tailwind CSS v4, and Vite.

[![Open Source Love](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red?style=for-the-badge)](https://github.com/tHEtRICKsTER-N/The-Blue)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](https://github.com/tHEtRICKsTER-N/The-Blue/pulls)
[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r180-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

---

## 🧭 What is ABYSS?

> *"Beneath the everyday. There’s a whole world beneath the surface. Follow the light. Find the unexpected. Take nothing but a moment."*

**ABYSS** is a completely client-side, browser-based 3D ocean exploration simulator. Designed as a contemplative interactive experience, it invites players to step away from high-stress gameplay—there are no enemies to fight, no timers ticking down, and no mandatory mission objectives. Instead, players are invited into a serene, living ocean ecosystem where they can freely dive, swim alongside marine wildlife, and discover the hidden beauty of the deep sea.

### 🌟 Key Highlights

- **Living Marine Ecosystem:** Encounter animated aquatic wildlife with procedural flocking and swimming dynamics—including schools of tropical reef fish, sea turtles, manta rays, bioluminescent deep-sea jellyfish, and oceanic whales.
- **Dynamic Underwater Atmosphere:** Custom shaders simulate water caustics, sunlight scattering, volumetric depth fog, dynamic wave surfaces, and suspended particulate (marine snow).
- **Living Weather & Sky:** A continuous 24-hour clock carries a real sun and moon arc, and five weather states — clear, overcast, sea mist, rain and storm — roll through on their own if you let them. Wind is a bearing as well as a speed, steering cloud drift, rain slant, surface chop and whitecaps together. Storms bring lightning with distance-delayed thunder, splash rings where the rain lands, and murkier water below.
- **Rich Exploration Biomes:** Descend from sunlit shallow coral reefs into shadowy underwater trenches, forgotten shipwrecks, and mysterious hydrothermal vents.
- **Dual Perspective (1st & 3rd Person):** Seamlessly transition between an immersive first-person diving mask and a full third-person diver view with responsive 6-degrees-of-freedom swimming controls.
- **Hydrophone Spatial Audio:** Atmospheric, generative hydrophone soundscapes featuring ambient diver breathing, bubble acoustics, deep ocean resonance, and tranquil musical tones.
- **Zero Backend Overhead:** ABYSS is 100% client-side. The entire 3D simulation, procedural shaders, and audio run natively in the visitor's browser, compiled as a static bundle that deploys globally on edge CDNs (such as Cloudflare Pages).

---

## 🎮 Controls (Desktop Browser)

> [!NOTE]
> ABYSS is designed primarily for desktop browsers with mouse and keyboard input for full 3D camera and swimming control.

| Key | Action |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Swim Forward / Left / Backward / Right |
| <kbd>SPACE</kbd> | Ascend / Surface toward the water line |
| <kbd>C</kbd> | Descend / Dive deeper into the ocean |
| <kbd>SHIFT</kbd> | Glide / Sprint boost |
| **Mouse** | 360° Free-look camera orientation |
| <kbd>V</kbd> | Toggle First-Person / Third-Person view |
| <kbd>F</kbd> | Toggle Diver Flashlight |
| <kbd>ESC</kbd> | Pause Menu, Sound Settings & Fast Travel to Biomes |

---

## ⚙️ Graphics, Weather & Performance

Everything below lives in the pause menu (<kbd>ESC</kbd>).

### Quality presets — *Graphics* tab

| Preset | Render resolution | Anti-aliasing | World / particles / view | Adaptive |
| :--- | :--- | :--- | :--- | :--- |
| **Performance** | 65% | FXAA | Low · Low · Near | On |
| **Balanced** | 85% | SMAA | Medium · Medium · Medium | On |
| **High** | 100% | MSAA 4× | High · High · Far | Off |
| **Ultra** | 125% (supersampled) | MSAA 8× | High · High · Ultra | Off |

Render resolution is a multiplier on the display's own pixel ratio, so **100% is always native** — on a
high-DPI laptop that is already more pixels than the CSS size suggests. The *Buffer* readout in the menu
header shows what is actually being rendered; if that number looks large for your GPU, drop the render
resolution before anything else.

**Adaptive quality** trims render resolution to hold 60 fps and hands it back when the frame rate recovers.
It rides on top of whatever render resolution you chose and never climbs past it, so your other settings are
left alone.

### Weather — *Environment* tab

- **Automatic** hands the weather to a scheduler that walks a transition table (clear → cloudy → rain →
  storm and back) on an 80–220 s dwell. Fronts crossfade over roughly 25 s. Picking a specific preset
  instead pins it, and lands in about 2.5 s so you can see it while the menu is still open.
- **Clock** and **Day / night cycle** drive a real sun and moon arc. A running clock also drags the
  automatic weather along with it, so a sped-up day does not sit under one sky.
- **Weather density** scales rain and spray volume — turn it down for a cheaper storm.

---

## 🛠️ Tech Stack

- **3D Graphics & Shaders:** [Three.js r180](https://threejs.org/) (GLSL shaders, custom materials, instanced meshes)
- **UI & Interaction:** [React 19](https://react.dev/), [@shadcn/react](https://ui.shadcn.com/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Audio Engine:** Web Audio API with procedural noise synthesis and spatial attenuation
- **Build Tooling & Fast Refresh:** [Vite 8](https://vitejs.dev/), [oxlint](https://oxc.rs/), [oxfmt](https://oxc.rs/)
- **Hosting & Infrastructure:** [Cloudflare Pages / Workers Static Assets](https://developers.cloudflare.com/pages/)

---

## 📂 Project Architecture

```text
The-Blue/
├── app/                      # Next.js / Sites App Router compatible pages & layout
├── components/               # React HUD, UI dialogs, and compatibility overlays
│   └── IncompatibleDeviceWarning.tsx
├── public/                   # Static audio, 3D assets, textures, and manifests
├── src/                      # Core 3D game simulation engine
│   ├── audio/                # Web Audio synthesis & spatial soundscape (AudioManager.js)
│   ├── core/                 # Main game loop, clock, and dialogue state (Game.js)
│   ├── creatures/            # Marine fauna, flocking algorithms & swimming logic
│   │   ├── MarineLife.js     # Pelagic fish, rays, sharks, whales
│   │   └── BenthicLife.js    # Coral, anemones, seabed life
│   ├── effects/              # Post-processing chain, volumetric lighting, marine snow
│   │   └── Atmosphere.js     # Composer, MSAA scene pass, bloom, colour grade, light shafts
│   ├── player/               # Diver avatar model, 6DOF controller & camera rig
│   └── world/                # Ocean terrain streaming, biomes, and surface shaders
│       ├── Environment.js    # Day/night clock, weather states, wind, rain & lightning
│       ├── OceanSurface.js   # Sea surface, sky, cloud field and star shaders
│       └── StreamingOcean.js # Chunked terrain streaming and biome placement
├── standalone/               # Pure static client entrypoint (index.html, main.tsx)
├── vite.static.config.mjs    # Static production bundle configuration
├── wrangler.jsonc            # Cloudflare Pages / Workers deployment configuration
└── DEVLOG.md                 # Architecture milestones, changelog & technical decisions
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: `v20` or `v22+` (LTS recommended) — [Download Node.js](https://nodejs.org)
- **npm**: `v10+`

### 1. Clone the Repository
```bash
git clone https://github.com/tHEtRICKsTER-N/The-Blue.git
cd The-Blue
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your desktop browser.

### 4. Code Quality & Formatting
We use [Oxc](https://oxc.rs/) tools for lightning-fast linting and formatting:
```bash
# Run the linter
npm run lint

# Format code
npm run format
```

---

## 📦 Building for Production

To compile the standalone, serverless static distribution:

```bash
npm run build:static
```

Compiled assets will be placed into `dist-static/`.

To preview the production bundle locally:
```bash
npx vite preview --config vite.static.config.mjs --host 127.0.0.1
```

---

## 🤝 Contributing (Open Source)

**ABYSS is an open-source project, and we welcome contributions from everyone!** Whether you are a 3D artist, shader enthusiast, game designer, web developer, sound engineer, or writer, there are many ways to make an impact.

### 💡 Ideas for Contributions

- 🐋 **Marine Life & Behaviors:** Create new sea creatures (octopuses, dolphins, deep-sea anglerfish, crabs) or improve boid flocking and schooling animations.
- 🪸 **Biomes & Underwater Landmarks:** Model or procedurally generate new destinations (sunken temples, kelp forests, underwater caverns).
- 🎨 **Shaders & Visual Effects:** Optimize water caustics, god rays, bioluminescent shaders, water distortion, or post-processing bloom.
- 🔊 **Sound Design & Music:** Compose ambient underwater soundscapes, hydrophone recordings, or dynamic creature audio.
- ⚡ **Performance Optimizations:** Enhance Three.js instancing, reduce draw calls, implement level-of-detail (LOD) rendering, or improve lower-end hardware framerates.
- 📱 **Controls & Accessibility:** Help add gamepad support, customizable keybindings, touch controls for tablets, or subtitle/audio descriptions.
- 📖 **Documentation & Guides:** Improve setup guides, comment shaders, or translate descriptions into other languages.

---

### 📥 Step-by-Step Pull Request Workflow

We follow a standard GitHub Fork-and-Pull-Request workflow:

#### 1. Fork the Repository
Click the **Fork** button at the top-right of the GitHub repository page to create a copy in your own account.

#### 2. Clone Your Fork
```bash
git clone https://github.com/<your-username>/The-Blue.git
cd The-Blue
```

#### 3. Create a Feature Branch
Always create a dedicated branch for your feature or bug fix:
```bash
git checkout -b feature/bioluminescent-jellyfish
# or
git checkout -b fix/caustic-shader-performance
```

#### 4. Make Your Changes & Test
- Run `npm run dev` and test your modifications locally in the browser.
- Verify that the static build succeeds:
  ```bash
  npm run build:static
  ```
- Run the linter and formatter:
  ```bash
  npm run lint
  npm run format
  ```

#### 5. Commit Your Changes
Write clear, concise commit messages:
```bash
git commit -m "feat(creatures): add pulsing glow to bioluminescent jellyfish"
```

#### 6. Push to Your Fork
```bash
git push origin feature/bioluminescent-jellyfish
```

#### 7. Open a Pull Request
1. Go to your fork on GitHub.
2. Click **Compare & pull request**.
3. Select `base: main` ← `compare: feature/your-feature-name`.
4. Provide a clear title and description explaining what your PR changes and why. If you added or changed visual elements, attaching a screenshot or screen recording is greatly appreciated!

---

### 🛡️ Contribution Guidelines & Conventions

- **Branch Protection:** Never commit directly to `main`. All changes must arrive through Pull Requests.
- **Focused Scope:** Keep Pull Requests focused on a single feature, improvement, or bug fix. Smaller, modular PRs are reviewed and merged much faster.
- **Friendly Community:** Treat all contributors and reviewers with respect, empathy, and constructive feedback.

---

## ☁️ Deployment (Cloudflare Pages)

The project is configured for continuous deployment on [Cloudflare Pages](https://pages.cloudflare.com/):

- **Build Command:** `npm run build:static`
- **Output Directory:** `dist-static`
- **Config:** [wrangler.jsonc](wrangler.jsonc)

Merging a Pull Request into `main` automatically triggers Cloudflare CI/CD to rebuild and deploy the live site.

For more technical architecture and hosting details, see:
- [HOSTING.md](HOSTING.md) — Hosting cost guide, limits, and custom domain setup.
- [DEVLOG.md](DEVLOG.md) — Architecture log, CI/CD diagnosis, and runtime fixes.

---

## 📄 License & Community

ABYSS is maintained as an open-source project by its creators and community contributors. Everyone is invited to dive in, build, and explore together. 🌊