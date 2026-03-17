# CLAUDE.md — Universal Email Automation Engine

## Project Purpose & Origin

This project started in 2023 as a Google Apps Script tool to automate operational emails for a workforce management team (shift handovers, status reports, KPI summaries). In v2.0 it was rewritten into a Node.js/TypeScript monorepo that keeps Google Workspace as the primary runtime but introduces a provider pattern so other platforms (SendGrid, AWS SES, Microsoft 365) can be added without touching core logic.

The v1 Apps Script source lives in `legacy/` for reference. Active development is in `packages/`.

---

## Tech Stack

- **Language**: TypeScript 5.4, targeting ES2020
- **Runtime**: Node.js ≥ 18 (development); Google Apps Script (production deployment via bundled `.gs` file)
- **Monorepo**: npm workspaces (root `package.json`)
- **Build**: `tsc` for Node.js output; `esbuild` for the Apps Script bundle (`EmailEngine.gs`)
- **Test framework**: Jest (configured in `packages/core`, no tests written yet)
- **CLI framework**: Commander.js (`packages/cli`)

---

## Package Structure

```
packages/
├── core/                      # Platform-agnostic engine — no Google deps
│   └── src/
│       ├── types/             # EmailConfig, ExecutionResult, Recipient, etc.
│       ├── providers/         # PlatformServices interface (contract)
│       └── services/          # EmailEngine orchestration class
│
├── apps-script-adapter/       # Google Workspace implementations (Apps Script runtime)
│   └── src/
│       ├── GoogleAppsEmailProvider.ts     # GmailApp wrapper
│       ├── GoogleDocsTemplateLoader.ts    # DocumentApp wrapper
│       ├── GoogleSheetsDataStore.ts       # SpreadsheetApp wrapper
│       ├── GoogleAppsLinkRepository.ts    # Centralized link store
│       ├── GoogleAppsLogger.ts            # Logger.log wrapper
│       └── index.ts
│
├── node-google-adapter/       # Google Workspace implementations (Node.js runtime)
│   └── src/
│       ├── providers/
│       │   └── NodeGoogleEmailProvider.ts  # Gmail API wrapper
│       ├── template/
│       └── index.ts
│
└── cli/                       # Terminal interface
    └── src/cli.ts             # Commander.js commands
```

---

## Provider / Plugin Pattern

`packages/core` defines interfaces (`EmailProvider`, `TemplateLoader`, `DataStore`, `Logger`) grouped into `PlatformServices`. `EmailEngine` receives a `PlatformServices` object in its constructor and calls only those interfaces — it never imports anything Google-specific.

`packages/apps-script-adapter` implements every interface using Google APIs. To add a new platform, implement the same interfaces in a new adapter package; no changes to core needed.

---

## Key Design Decisions

- **Templates live in Google Docs** — rich-text editing, no HTML knowledge required from ops teams.
- **Recipient dictionary lives in Google Sheets** — non-technical staff can manage the list without deploying code.
- **esbuild IIFE bundle** — Apps Script has no module system, so the adapter and all its core dependencies are compiled to a single `EmailEngine.gs` file exposed as a global IIFE object.
- **Three execution modes**: `PROD` (real recipients), `TEST` (sends only to current user), `DRY_RUN` (no emails created).
- **Draft recycling** — the engine looks for an existing draft with the same subject before creating a new one, preventing inbox clutter during repeated runs.

---

## Current State (as of March 2026)

- Monorepo scaffolding and all source files exist.
- `npm install` works at root.
- Build has been run - `packages/*/dist/` directories exist.
- Tests are being implemented in `packages/core/test/`.
- The Apps Script bundle (`dist/EmailEngine.gs`) compiles successfully.

---

## Roadmap Priorities

1. Run `npm run build` and verify the Apps Script bundle compiles.
2. Add Microsoft 365 / Graph API adapter (`packages/m365-adapter`).
3. Build a Google Sheets sidebar UI for no-code trigger configuration.

---

## Common Commands

```bash
# Install all workspace dependencies
npm install

# Build all packages (core → adapter → cli)
npm run build

# Build only core
npm run build:core

# Build only the Apps Script adapter (outputs EmailEngine.gs)
npm run build:adapter

# Run tests
npm test

# Watch mode
npm run dev:core
npm run dev:adapter
npm run dev:cli

# Lint / format
npm run lint
npm run format
```

---

## Directory Reference

| Path                           | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `packages/core`                | Platform-agnostic engine (pure TypeScript)         |
| `packages/apps-script-adapter` | Google Workspace implementation                    |
| `packages/cli`                 | Terminal CLI                                       |
| `legacy/`                      | v1 Apps Script source (reference only, not active) |
| `docs/`                        | Additional documentation                           |
| `ARCHITECTURE.md`              | Architecture diagrams and data-flow docs           |
| `MIGRATION.md`                 | v1 → v2 migration guide                            |
| `ROADMAP.md`                   | Planned features                                   |
