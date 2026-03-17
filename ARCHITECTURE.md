# Architecture Deep Dive

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Universal Email Automation Engine v2.0               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
        ┌───────▼────────┐  ┌──────▼───────┐  ┌───────▼────────┐
        │   @universal   │  │  @universal  │  │   @universal   │
        │   -email/core  │  │  -email/     │  │   -email/cli   │
        │                │  │  apps-script │  │                │
        │  Pure TypeScript│  │  -adapter    │  │  Commander.js  │
        │  Platform-agnostic│ │  Google APIs │  │  Terminal UI   │
        └───────┬────────┘  └──────┬───────┘  └───────┬────────┘
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    │
                        ┌───────────▼────────────┐
                        │   Your Application     │
                        │                        │
                        │  - Node.js app         │
                        │  - Google Apps Script  │
                        │  - CLI commands        │
                        └────────────────────────┘
```

---

## Package Dependencies

```
@universal-email/cli
    │
    ├─→ @universal-email/core
    │
    └─→ @universal-email/apps-script-adapter
            │
            └─→ @universal-email/core

@universal-email/core
    ├─→ handlebars (template engine)
    └─→ node-fetch (HTTP requests)

@universal-email/apps-script-adapter
    ├─→ @universal-email/core
    └─→ @types/google-apps-script (dev)
```

---

## Data Flow: Single Email Generation

```
┌──────────────┐
│   User/CLI   │
│  Invocation  │
└──────┬───────┘
       │ generateEmailDraft('Morning_Status', config)
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    EmailEngine (Core)                        │
│                                                              │
│  1. Merge configs (defaults + user overrides)               │
│  2. Determine mode (PROD / TEST / DRY_RUN)                  │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├──────────────┬────────────────┬─────────────────┐
       │              │                │                 │
       ▼              ▼                ▼                 ▼
┌────────────┐ ┌───────────┐ ┌──────────────┐ ┌─────────────┐
│ Template   │ │  Data     │ │  Recipient   │ │   Link      │
│ Loader     │ │  Store    │ │  Resolver    │ │ Repository  │
│            │ │           │ │              │ │             │
│ Google Docs│ │ Google    │ │ Directory    │ │ Centralized │
│ or other   │ │ Sheets    │ │ Sheet        │ │ URLs        │
└─────┬──────┘ └─────┬─────┘ └──────┬───────┘ └──────┬──────┘
      │              │               │                │
      └──────────────┴───────────────┴────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │  Template Processing │
                  │                      │
                  │  - Dictionary replace│
                  │  - Date tokens       │
                  │  - Greeting          │
                  │  - Link injection    │
                  │  - Table rendering   │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   Email Provider    │
                  │                     │
                  │  - Find existing    │
                  │  - Create/Update    │
                  │  - Send (optional)  │
                  └──────────┬──────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │   ExecutionResult   │
                  │                     │
                  │  - success: boolean │
                  │  - draftId: string  │
                  │  - duration: number │
                  │  - logs: array      │
                  └─────────────────────┘
```

---

## Provider Pattern Detail

```typescript
┌─────────────────────────────────────────────────────────────┐
│  Core Defines Interfaces (platform-agnostic)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  interface EmailProvider {                                  │
│    createDraft(subject, body, to): Promise<string>;         │
│    updateDraft(draftId, subject, body): Promise<void>;      │
│    sendEmail(draftId?): Promise<void>;                      │
│  }                                                          │
│                                                             │
│  interface TemplateLoader {                                 │
│    loadTemplate(name, sourceId): Promise<ParsedTemplate>;   │
│  }                                                          │
│                                                             │
│  interface DataStore {                                      │
│    getTabData(sheetId, tabName): Promise<Record[]>;         │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ implements
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Apps Script Adapter Implements (Google-specific)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  class GoogleAppsEmailProvider implements EmailProvider {   │
│    createDraft(subject, body, to) {                         │
│      return GmailApp.createDraft(...).getId();              │
│    }                                                        │
│    /* ... */                                                │
│  }                                                          │
│                                                             │
│  class GoogleDocsTemplateLoader implements TemplateLoader { │
│    loadTemplate(name, sourceId) {                           │
│      const doc = DocumentApp.openById(sourceId);             │
│      /* ... */                                              │
│    }                                                        │
│  }                                                          │
│                                                             │
│  class GoogleSheetsDataStore implements DataStore {         │
│    getTabData(sheetId, tabName) {                           │
│      const sheet = SpreadsheetApp.openById(sheetId);        │
│      /* ... */                                              │
│    }                                                        │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Future adapters
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Future: Other Platforms                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  class SendGridProvider implements EmailProvider { ... }    │
│  class SESProvider implements EmailProvider { ... }         │
│  class GraphProvider implements EmailProvider { ... }       │
│                                                             │
│  class FileSystemTemplateLoader implements TemplateLoader { │
│    loadTemplate(name, path) {                               │
│      return fs.readFile(`${path}/${name}.hbs`);             │
│    }                                                        │
│  }                                                          │
│                                                             │
│  class PostgresDataStore implements DataStore {             │
│    getTabData(table, filters) {                             │
│      return db.query(`SELECT * FROM ${table}`);             │
│    }                                                        │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Pipeline (Apps Script Adapter)

```
┌─────────────────────────────────────────────────────────────┐
│  Source Files (TypeScript)                                  │
├─────────────────────────────────────────────────────────────┤
│  packages/core/src/                                         │
│    ├── types/index.ts                                       │
│    ├── providers/index.ts                                   │
│    └── services/EmailEngine.ts                              │
│                                                             │
│  packages/apps-script-adapter/src/                          │
│    ├── index.ts                                             │
│    ├── GoogleAppsEmailProvider.ts                           │
│    ├── GoogleDocsTemplateLoader.ts                          │
│    ├── GoogleSheetsDataStore.ts                             │
│    ├── GoogleAppsLinkRepository.ts                          │
│    └── GoogleAppsLogger.ts                                  │
└─────────────────────────────────────────────────────────────┘
       │
       │ npm run build
       │ (TypeScript compiler)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Compiled JavaScript (dist/)                                │
├─────────────────────────────────────────────────────────────┤
│  packages/core/dist/                                        │
│    ├── types/index.js                                       │
│    ├── providers/index.js                                   │
│    └── services/EmailEngine.js                              │
│                                                             │
│  packages/apps-script-adapter/dist/                         │
│    ├── index.js                                             │
│    └── *.js                                                 │
└─────────────────────────────────────────────────────────────┘
       │
       │ npm run build:bundle
       │ (esbuild bundler)
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Bundled Output (EmailEngine.gs)                            │
├─────────────────────────────────────────────────────────────┤
│  /** @OnlyCurrentDoc */                                     │
│  var EmailEngine = (function() {                            │
│    // All core code here                                    │
│    // All adapter code here                                 │
│    return {                                                 │
│      generateEmailDraft: function(template, config) {...},  │
│      generateBatchDrafts: function(templates, config) {...} │
│    };                                                       │
│  })();                                                      │
└─────────────────────────────────────────────────────────────┘
       │
       │ Copy to Apps Script project
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Google Apps Script Runtime                                 │
├─────────────────────────────────────────────────────────────┤
│  function sendMorningReport() {                             │
│    EmailEngine.generateEmailDraft('Morning_Status', {       │
│      templateDocumentId: '...',                             │
│      emailAction: 'DRAFT'                                   │
│    });                                                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Mode Comparison

```
┌──────────────────────────────────────────────────────────────┐
│  PROD Mode (Default)                                         │
├──────────────────────────────────────────────────────────────┤
│  • Reads real recipients from Directory Sheet               │
│  • Creates drafts in real Gmail                             │
│  • Sends if emailAction: 'SEND'                             │
│  • Logs to System_Logs sheet                                │
│                                                              │
│  Use for: Production deployments                            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  TEST Mode (testMode: true)                                  │
├──────────────────────────────────────────────────────────────┤
│  • Ignores real recipients                                  │
│  • Sends only to current user (you)                         │
│  • Safe to test with real data                              │
│  • Logs to System_Logs sheet                                │
│                                                              │
│  Use for: Testing before deployment                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  DRY_RUN Mode (dryRun: true)                                 │
├──────────────────────────────────────────────────────────────┤
│  • Processes everything                                     │
│  • Does NOT create drafts                                   │
│  • Does NOT send emails                                     │
│  • Logs everything to console                               │
│                                                              │
│  Use for: Debugging, validation                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Execution Flow with Error Handling

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Load Config     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     Error
│ Validate Config │──────────────┐
└──────┬──────────┘              │
       │ OK                      ▼
       │                  ┌──────────────┐
       ▼                  │ Log Error    │
┌─────────────────┐       │ Return fail  │
│ Load Template   │◄──────┤              │
└──────┬──────────┘       └──────────────┘
       │
       ▼
┌─────────────────┐     Error
│ Parse Template  │──────────────┐
└──────┬──────────┘              │
       │ OK                      ▼
       │                  ┌──────────────┐
       ▼                  │ Log Error    │
┌─────────────────┐       │ Return fail  │
│ Resolve Recip.  │◄──────┤              │
└──────┬──────────┘       └──────────────┘
       │
       ▼
┌─────────────────┐     Error
│ Validate Recip. │──────────────┐
└──────┬──────────┘              │
       │ OK                      ▼
       │                  ┌──────────────┐
       ▼                  │ Log Error    │
┌─────────────────┐       │ Return fail  │
│ Process Template│◄──────┤              │
└──────┬──────────┘       └──────────────┘
       │
       ▼
┌─────────────────┐     Error
│ Create Draft    │──────────────┐
└──────┬──────────┘              │
       │ OK                      ▼
       │                  ┌──────────────┐
       ▼                  │ Log Error    │
┌─────────────────┐       │ Return fail  │
│ Send? (optional)│◄──────┤              │
└──────┬──────────┘       └──────────────┘
       │
       ▼
┌─────────────────┐
│ Log Execution   │
│ (System_Logs)   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Return Result   │
│ {success,       │
│  draftId,       │
│  duration}      │
└─────────────────┘
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│  Data Never Leaves Google's Ecosystem                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Google Docs ──┐                                            │
│                │                                            │
│  Google Sheets─┼──► Engine ──► Gmail Drafts                │
│                │                                            │
│  Google Drive ─┘                                            │
│                                                             │
│  No external APIs called                                    │
│  No data sent to third parties                              │
│  All processing happens in Google's servers                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OAuth Scopes Required                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  https://www.googleapis.com/auth/gmail.compose             │
│    → Create and manage drafts                              │
│                                                             │
│  https://www.googleapis.com/auth/documents                 │
│    → Read template documents                               │
│                                                             │
│  https://www.googleapis.com/auth/spreadsheets              │
│    → Read data and configuration                           │
│                                                             │
│  https://www.googleapis.com/auth/drive.readonly            │
│    → Access logos and signatures                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│  Unit Tests (Jest) - Core Package                           │
├─────────────────────────────────────────────────────────────┤
│  ✓ Template parsing                                         │
│  ✓ Dictionary replacement                                   │
│  ✓ Date token processing                                    │
│  ✓ Link injection                                           │
│  ✓ Recipient resolution                                     │
│  ✓ Error handling                                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Integration Tests - Apps Script Adapter                    │
├─────────────────────────────────────────────────────────────┤
│  ✓ Google Docs template loading (manual)                    │
│  ✓ Google Sheets data retrieval (manual)                    │
│  ✓ Gmail draft creation (manual)                            │
│  ✓ End-to-end workflow (manual)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CLI Tests                                                  │
├─────────────────────────────────────────────────────────────┤
│  ✓ Command parsing                                          │
│  ✓ Flag handling                                            │
│  ✓ Output formatting                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

```
┌──────────────────────────────────────────────────────────────┐
│  Apps Script Limits                                          │
├──────────────────────────────────────────────────────────────┤
│  • Execution timeout: 6 minutes per run                     │
│  • Email quota: 2,000/day (Workspace)                       │
│  • Cache size: 100KB                                        │
│  • URL Fetch quota: 20,000/day                              │
│                                                              │
│  Mitigation:                                                 │
│  • generateBatchDrafts() has built-in time checks           │
│  • CacheService for repeated operations                     │
│  • Draft recycling prevents duplicates                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Node.js Performance                                         │
├──────────────────────────────────────────────────────────────┤
│  • No execution timeout (your server)                       │
│  • Rate limiting by email provider                          │
│  • Memory: depends on your environment                      │
│                                                              │
│  Optimization:                                               │
│  • Batch processing                                         │
│  • Connection pooling                                       │
│  • Caching layer (Redis, etc.)                              │
└──────────────────────────────────────────────────────────────┘
```
