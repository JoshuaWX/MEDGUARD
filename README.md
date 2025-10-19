# MedGuard

MedGuard is a mobile-first, static front-end prototype for a health companion app focused on disease alerts, an AI health chatbot, and local health resources. The UI is built with plain HTML pages and Tailwind CSS (CDN) and is designed for quick prototyping and user testing.

This repository contains static HTML mockups for the core app screens used during design and early development.

## Features
- Mobile-first UI for health alerts, chatbot, map, profiles, and onboarding.
- Dark/light theme support via Tailwind's `dark` class.
- Prototype-ready pages (no backend required for static browsing).

## Tech stack
- HTML (static pages)
- Tailwind CSS via CDN (development / prototyping)
- Google Fonts & Material Symbols (icons)

## Quick start (open locally)
Option A — Open files directly in your browser (quick and easy):

1. Open `index` page or any HTML file in your browser (double-click the `.html` file). Example files: `welcome.html`, `home.html`, `chatbot.html`.

Option B — Run a simple local static server (recommended to avoid CORS / relative-path issues):

From the repository root in your terminal (Git Bash / bash on Windows):

```bash
# Using Python 3 (works if Python is installed)
python -m http.server 8000
# Then open http://localhost:8000/welcome.html

# Or, if you have Node installed, using a tiny static server (install once):
# npm i -g http-server
http-server -p 8000
# Then open http://localhost:8000/welcome.html
```

## Development notes
These pages use Tailwind via the CDN for rapid iteration. For production, you should compile Tailwind and remove unused classes to reduce CSS size.

Suggested minimal production steps:

1. Install Node.js (LTS).
2. Add a project `package.json` and install Tailwind & PostCSS.
3. Move local styles into a single stylesheet and configure `tailwind.config.js` with a `content` list that includes these HTML files.
4. Build a production CSS file with Purge enabled (Tailwind `content` scanning) and serve that instead of the CDN script.

If you'd like, I can scaffold a minimal `package.json`, `tailwind.config.js`, and build script for you.

## Accessibility & QA checklist
- [ ] Add `aria-label` or visible text for every icon-only button (back arrows, send, mic, etc.).
- [ ] Use real `<label>` elements for inputs; avoid placeholder-only labels.
- [ ] Replace custom toggles with accessible `<input type="checkbox">` or implement `role="switch"` + keyboard handlers and `aria-checked` updates.
- [ ] Ensure visible focus styles (avoid removing outlines without a replacement focus indicator).
- [ ] Verify color contrast in dark mode for small text and subtle colors.
- [ ] Host critical images locally or on a controlled CDN to avoid third-party requests during testing.

## Project structure (top-level files)
- `welcome.html` — landing / onboarding
- `signup.html`, `signup2.html` — onboarding / signup flows
- `home.html` — dashboard
- `chatbot.html` — AI chat UI prototype
- `map.html` — disease map mock
- `myhealth.html` — user health dashboard
- `alerts.html` — alerts and notifications
- `profile.html` — user profile
- `settings.html` — settings & support
- `codeimages/` — screenshots and assets used by the mockups

## Suggested next steps (I can do these for you)
- Add small accessibility fixes (aria-labels and replace the `settings` toggle with an accessible checkbox) — quick wins.
- Consolidate repeated Tailwind config and styles into a single partial and update HTML files to import it.
- Scaffold a minimal Tailwind build (Node + tailwindcss) and a `build` script to produce a production-ready CSS file.
- Run an accessibility audit (Lighthouse/axe) and produce a prioritized report.

If you want one of the above, tell me which and I'll implement it.

## Contributing
This is a small prototype. If you want changes, open an issue or send a branch/PR. Keep HTML and styles consistent and prefer shared components for repeated UI patterns.

## License
This repository doesn't have a license file yet. If you'd like, I can add an MIT license or another license of your choosing.

---
Generated on October 19, 2025 — created by the project maintainer tools. If anything in this README should be adjusted to match your workflow or deployment, tell me and I'll update it.