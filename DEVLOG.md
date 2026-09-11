# ABYSS — Developer Log (DevLog)

This document tracks technical decisions, architecture milestones, and deployment configurations for the ABYSS project.

---

## [2026-09-11] — Production Deployment & Cloudflare CI/CD Pipeline

### 1. Context & Motivation
- The project is an interactive 3D underwater exploration experience built with Three.js, React, Tailwind CSS, and Vite.
- Goal: Deploy the website publicly at zero recurring hosting cost, automate continuous delivery on git pushes, and set up a foundation for adding custom domains later.

### 2. Hosting & Infrastructure Decisions
- **Provider:** Cloudflare Pages / Workers Static Assets.
- **Cost:** $0.00/month (Free Tier).
- **Subdomain:** Deployed using the free default `*.pages.dev` subdomain provided by Cloudflare, offering built-in global CDN caching, DDoS mitigation, and automated TLS/SSL certificate generation.
- **Custom Domain Strategy:** Cloudflare Registrar was chosen as the recommended path for future domain purchases due to zero-markup ("at-cost") wholesale pricing without aggressive renewal hikes.

### 3. Build Architecture
- The project retains the original Next.js/Sites compatibility setup (`vinext`) for development while providing a pure browser-executable bundle via:
  - **Config:** `vite.static.config.mjs`
  - **Entry:** `standalone/index.html` & `standalone/main.tsx`
  - **Build Command:** `npm run build:static`
  - **Output Target:** `dist-static/`
- Verified local and remote compilation time: ~1.8–2.0 seconds with full asset gzip optimization.

### 4. CI/CD Issue Diagnosis & Resolution
- **Issue:** During the initial Cloudflare Pages/Workers Git build, Cloudflare invoked `npx wrangler deploy`. Because no root configuration file existed:
  1. Wrangler launched an interactive setup wizard in a non-interactive CI terminal.
  2. Wrangler misidentified the build directory as `dist/` rather than `dist-static/`.
  3. The wizard attempted an implicit `npm install wrangler`, which failed due to a peer dependency resolution conflict (`npm error ERESOLVE`) between root `@cloudflare/workers-types` and latest Wrangler versions.
- **Solution:**
  - Created a dedicated `wrangler.jsonc` file at the root repository:
    ```jsonc
    {
      "$schema": "node_modules/wrangler/config-schema.json",
      "name": "the-blue",
      "compatibility_date": "2026-09-11",
      "assets": {
        "directory": "./dist-static",
        "not_found_handling": "single-page-application"
      }
    }
    ```
  - Configured assets to route to `./dist-static` with Single Page Application (`index.html`) fallback handling.
  - Tested locally with `npx wrangler deploy --dry-run`, confirming direct asset bundle reading without triggering interactive package installation.

### 5. Repository & Git Hygiene
- Added build and runtime artifacts to `.gitignore`:
  - `dist-static/` (compiled production client files)
  - `.wrangler/` (local Cloudflare state and logs)
  - `.vinext/` (local Next.js compatibility cache)
- Established branch conventions:
  - `main`: Production-ready branch connected to Cloudflare CI/CD for auto-deployment.
  - `feature/*`: Working branches for experimental systems and active feature development (e.g. `feature/weather-system`).
