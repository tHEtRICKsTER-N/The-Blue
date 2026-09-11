# ABYSS — The Blue 🌊

> An atmospheric, browser-based 3D underwater exploration experience built with Three.js, React 19, and Vite.

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r180-black?style=for-the-badge&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

---

## 🧭 About the Project

**ABYSS** is a fully client-side 3D ocean simulation that allows players to freely explore marine depths, encounter oceanic wildlife, navigate underwater biomes, and experience realistic aquatic soundscapes—all directly within any modern desktop web browser.

### Key Features
- **Immersive Underwater Simulation:** Real-time water caustic shaders, volumetric fog, sun shafts, and dynamic water physics.
- **Marine Life Ecosystem:** Ambient aquatic creatures, schooling behaviors, and biome-specific organisms.
- **Dual Perspectives:** Seamlessly toggle between First-Person diver perspective and Third-Person view.
- **Spatial Audio:** Atmospheric hydrophone sound design and 3D spatial acoustics.
- **Zero Server Overhead:** Completely static client-side bundle deployed on Cloudflare edge CDN with instant loading.

---

## 🎮 Controls (Desktop Browser)

| Key | Action |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Swim Forward / Left / Backward / Right |
| <kbd>SPACE</kbd> | Ascend / Surface toward the water line |
| <kbd>C</kbd> | Descend / Dive deeper into the ocean |
| <kbd>SHIFT</kbd> | Glide / Sprint boost |
| **Mouse** | 360° Free-look camera orientation |
| <kbd>V</kbd> | Toggle First-Person / Third-Person view |
| <kbd>F</kbd> | Toggle Diver Flashlight |
| <kbd>ESC</kbd> | Pause Menu & Audio / Video Settings |

---

## 🛠️ Tech Stack

- **Rendering & 3D:** [Three.js](https://threejs.org/)
- **UI Framework:** [React 19](https://react.dev/), [@shadcn/react](https://ui.shadcn.com/), [Tailwind CSS v4](https://tailwindcss.com/)
- **Build Tooling:** [Vite](https://vitejs.dev/), [oxlint](https://oxc.rs/), [oxfmt](https://oxc.rs/)
- **Hosting & Infrastructure:** [Cloudflare Pages / Workers Static Assets](https://developers.cloudflare.com/pages/)

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v20 or v22+ (LTS recommended) — [Download Node.js](https://nodejs.org)
- **npm**: v10+

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/tHEtRICKsTER-N/The-Blue.git
   cd The-Blue
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Building for Production

To create the portable, standalone client-side distribution:

```bash
npm run build:static
```

Compiled assets will be generated in `dist-static/`.

To preview the production build locally:
```bash
npx vite preview --config vite.static.config.mjs --host 127.0.0.1
```

---

## ☁️ Deployment (Cloudflare Pages)

The project includes continuous deployment through Cloudflare Pages and Git:

- **Build Command:** `npm run build:static`
- **Output Directory:** `dist-static`
- **Config:** Managed via `wrangler.jsonc`

Every push to the `main` branch automatically triggers a rebuild and deploys updates to the live site at `*.pages.dev`.

For full hosting documentation, refer to [HOSTING.md](HOSTING.md) and [DEVLOG.md](DEVLOG.md).

---

## 🤝 Contributing

We welcome contributions! To maintain code quality and production stability:

1. **Do not push directly to `main`**. The `main` branch is connected to automated production deployments.
2. Create a feature branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes and push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a **Pull Request (PR)** against `main` for review.