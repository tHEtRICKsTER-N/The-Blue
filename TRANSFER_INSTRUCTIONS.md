# ABYSS — Project Transfer & Setup Guide

This archive contains the complete source code, 3D assets, audio, environment systems, and full Git repository history for **ABYSS**.

---

## 1. Prerequisites on the New PC

Ensure you have installed:
- **Node.js**: v20 or v22+ (LTS recommended)
  - Download from: https://nodejs.org
- **Git**: (Optional, if you want to push to GitHub / GitLab)
  - Download from: https://git-scm.com

Verify installation in your terminal:
```bash
node -v
npm -v
git --version
```

---

## 2. Setup & Installation

1. Open your terminal or Command Prompt in this extracted folder.
2. Install all dependencies:
   ```bash
   npm install
   ```
   *Note: `node_modules` was intentionally excluded from the archive to keep the transfer fast, lightweight, and avoid OS-specific binary issues.*

3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your desktop browser.

---

## 3. Uploading to GitHub / Git Remote

The `.git` repository and all commit history (including the latest mobile/portrait launch guards) are fully preserved.

To upload this to a new GitHub repository:

1. Create a new empty repository on [GitHub](https://github.com/new) (do **not** initialize with README or .gitignore since this repo already has them).
2. Link your new GitHub repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   ```
3. Set the branch name to `main` and push:
   ```bash
   git branch -M main
   git push -u origin main
   ```

To verify status at any time:
```bash
git status
git log -n 5
```

---

## 4. Useful Project Commands

- `npm run dev` — Start the local development server with hot-reload.
- `npm run build` — Create the full production build.
- `npm run build:static` — Create a portable static HTML/CSS/JS export in `dist-static/`.
- `npm run lint` — Run `oxlint` to check for linting errors.

---

## 5. Controls (Desktop PC Only)

- **W, A, S, D**: Swim forward, backward, left, right
- **SPACE**: Surface / ascend
- **C**: Dive / descend
- **SHIFT**: Glide boost
- **Mouse**: 360° free look camera
- **V**: Toggle First-Person / Third-Person view
- **F**: Toggle diver flashlight
- **ESC**: Pause menu & expedition settings
