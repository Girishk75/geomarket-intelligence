# GeoMarket Intelligence

A 9-agent AI financial analysis system for Indian equity markets, built with Vite + React and deployed on GitHub Pages.

## Features

- **9 specialized AI agents** powered by Anthropic Claude for deep equity analysis
- **Real-time data** from Yahoo Finance via the allorigins.win CORS proxy
- **No backend required** — runs entirely in the browser
- **API key stored locally** in `localStorage` — never sent to any intermediary server

## Live App

> `https://Girishk75.github.io/geomarket-intelligence/`

## Setup

### 1. Fork / clone the repository

```bash
git clone https://github.com/Girishk75/geomarket-intelligence.git
cd geomarket-intelligence
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
npm run dev
```

Open `http://localhost:5173/geomarket-intelligence/` in your browser.

### 4. Enter your Anthropic API key

On first launch the Settings screen appears. Paste your key from
[console.anthropic.com](https://console.anthropic.com/). The key is stored in
`localStorage` and never leaves your browser except when calling the Anthropic API directly.

## GitHub Pages Deployment

Deployment is automatic — every push to `main` triggers the
`.github/workflows/deploy.yml` workflow, which builds the app and publishes the
`dist/` folder to GitHub Pages.

### First-time GitHub Pages setup

1. Go to **Settings → Pages** in your GitHub repository.
2. Under **Source**, choose **GitHub Actions**.
3. Push to `main` — the workflow runs and your site will be live within ~2 minutes.

## Project Structure

```
src/
├── components/
│   ├── Settings.jsx      # API key management screen
│   └── Settings.css
├── App.jsx               # Main application shell
├── App.css
├── main.jsx
└── index.css
.github/
└── workflows/
    └── deploy.yml        # CI/CD pipeline
vite.config.js            # base path set to /geomarket-intelligence/
```

## Data Sources

| Source | Method |
|--------|--------|
| Yahoo Finance | Fetched via `https://api.allorigins.win/raw?url=...` to bypass CORS |
| Anthropic Claude | Called directly from the browser using your API key |

## License

MIT
