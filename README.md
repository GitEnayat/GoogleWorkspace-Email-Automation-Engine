# Universal Email Automation Engine v2.0

> **From Google Apps Script to Universal Platform** — A configuration-driven email orchestration engine now built with Node.js & TypeScript, supporting multiple platforms including Google Apps Script.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)
[![Status: Stable](https://img.shields.io/badge/Status-Stable-green)](https://github.com/anomalyco/universal-email-automation)

---

## 🎯 What's New in v2.0

**Complete rewrite from Google Apps Script to Node.js/TypeScript!**

This project has evolved from a Google Apps Script-only solution to a **universal email orchestration platform** with:

- ✅ **Platform-agnostic core** - Pure TypeScript logic that works anywhere
- ✅ **Google Apps Script adapter** - Drop-in replacement for the original v1.0
- ✅ **CLI tool** - Run email automation from your terminal
- ✅ **Future-proof** - Easy to add adapters for SendGrid, AWS SES, Outlook, etc.

---

## 🏗️ Architecture

### Monorepo Structure

```
universal-email-automation/
├── packages/
│   ├── core/                    # Platform-agnostic engine
│   │   ├── src/
│   │   │   ├── types/           # TypeScript interfaces
│   │   │   ├── providers/       # Platform contracts
│   │   │   └── services/        # Core business logic
│   │   └── package.json
│   │
│   ├── apps-script-adapter/     # Google Apps Script implementation
│   │   ├── src/
│   │   │   ├── GoogleAppsEmailProvider.ts
│   │   │   ├── GoogleDocsTemplateLoader.ts
│   │   │   ├── GoogleSheetsDataStore.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── cli/                     # Command-line interface
│       ├── src/
│       │   └── cli.ts
│       └── package.json
│
├── package.json                 # Root workspace config
└── tsconfig.json                # TypeScript config
```

### Platform Abstraction

The core innovation: **Provider Pattern** that abstracts platform-specific APIs:

```typescript
// Core defines interfaces
interface EmailProvider {
  createDraft(subject, body, to): Promise<string>;
  sendEmail(draftId): Promise<void>;
  // ...
}

// Google Apps Script implements it
class GoogleAppsEmailProvider implements EmailProvider {
  createDraft(subject, body, to) {
    return GmailApp.createDraft(to.join(','), subject, body).getId();
  }
  // ...
}

// Future: SendGrid adapter
class SendGridProvider implements EmailProvider {
  createDraft(subject, body, to) {
    // SendGrid personalization drafts
  }
}
```

---

## 📦 Installation

### As npm Packages (Recommended for Node.js projects)

```bash
# Install core engine
npm install @universal-email/core

# Install Google Apps Script adapter (if using GAS)
npm install @universal-email/apps-script-adapter

# Install CLI globally
npm install -g @universal-email/cli
```

### For Google Apps Script Projects

```bash
cd packages/apps-script-adapter
npm install
npm run build
```

This creates a bundled `dist/EmailEngine.gs` file ready for Apps Script.

---

## 🚀 Quick Start

### Option 1: Using the CLI

```bash
# Initialize a new project
email-engine init

# Generate a draft (dry run)
email-engine generate Morning_Status --dry-run

# Generate and send (test mode)
email-engine generate Weekly_Report --test --send

# Validate a template
email-engine validate Morning_Status --doc-id "your-doc-id"
```

### Option 2: Node.js Application

```typescript
import { EmailEngine } from '@universal-email/core';
import { 
  GoogleAppsEmailProvider,
  GoogleDocsTemplateLoader,
  GoogleSheetsDataStore,
  GoogleAppsLogger
} from '@universal-email/apps-script-adapter';

// Create providers
const emailProvider = new GoogleAppsEmailProvider();
const templateLoader = new GoogleDocsTemplateLoader();
const dataStore = new GoogleSheetsDataStore();
const logger = new GoogleAppsLogger();

// Create engine
const engine = new EmailEngine({
  email: emailProvider,
  template: templateLoader,
  data: dataStore,
  logger
});

// Generate draft
const result = await engine.generateEmailDraft('Morning_Status', {
  templateDocumentId: 'your-doc-id',
  directorySheetId: 'your-sheet-id',
  testMode: true
});

console.log(`Draft created: ${result.draftId}`);
```

### Option 3: Google Apps Script (Library)

After building the adapter:

```javascript
// Code.gs in your Apps Script project
function sendMorningReport() {
  const config = {
    templateDocumentId: '1234567890abcdef...',
    directorySheetId: '9876543210zyxwv...',
    emailAction: 'DRAFT'
  };
  
  // Call the bundled engine
  const result = EmailEngine.generateEmailDraft('Morning_Status', config);
  
  Logger.log(`Draft created: ${result.draftId}`);
}

function sendAndSend() {
  EmailEngine.generateEmailDraft('Weekly_Report', {
    emailAction: 'SEND'
  });
}
```

---

## 🎨 Template Syntax

Templates live in **Google Docs** with special tags:

### Basic Replacement
```
Hello {{FirstName}},

Your shift starts at {{StartTime}}.
```

### Date Tokens
```
Report Date: {{DATE:Today}}
Next Review: {{DATE:Next Monday}}
```

### Greeting
```
{{GREETING}}, team!
→ "Good Morning, team!" (before 12 PM)
→ "Good Afternoon, team!" (12-5 PM)
→ "Good Evening, team!" (after 5 PM)
```

### Data Tables from Sheets
```
[Table] Sheet: <spreadsheet-id>, range: 'Q1_Results'!A1:E10
```

### Managed Links
```
Please update the $LINK:Tracker_Sheet, TEXT:Project Tracker$
→ <a href="https://...">Project Tracker</a>
```

---

## 🛠️ Development

### Prerequisites

- Node.js >= 18
- npm >= 9
- Google Apps Script account (for GAS adapter)

### Setup

```bash
# Clone repository
git clone https://github.com/anomalyco/universal-email-automation.git
cd universal-email-automation

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Development Mode

```bash
# Watch mode for core
npm run dev:core

# Watch mode for adapter
npm run dev:adapter

# Watch mode for CLI
npm run dev:cli
```

### Building for Apps Script

```bash
cd packages/apps-script-adapter
npm run build
```

This creates:
- `dist/index.js` - TypeScript output
- `dist/EmailEngine.gs` - Bundled for Apps Script

### Deploying to Apps Script

#### Method 1: Manual Copy
1. Open Google Apps Script editor
2. Copy contents of `dist/EmailEngine.gs`
3. Create wrapper functions in your project

#### Method 2: Using clasp
```bash
npm install -g @google/clasp
clasp login
clasp create
clasp push
```

---

## 📊 Comparison: v1.0 vs v2.0

| Feature | v1.0 (Apps Script) | v2.0 (Node.js) |
|---------|-------------------|----------------|
| **Platform** | Google Apps Script only | Universal (Node.js + adapters) |
| **Language** | JavaScript | TypeScript |
| **Testing** | Manual testing | Jest + unit tests |
| **Type Safety** | None | Full TypeScript |
| **Package Management** | None | npm workspaces |
| **CI/CD** | Manual | GitHub Actions ready |
| **Extensibility** | Hard-coded Google APIs | Plugin architecture |
| **CLI** | None | Full CLI tool |
| **Future Adapters** | N/A | SendGrid, SES, Outlook ready |

---

## 🔌 Future Adapters (Planned)

The architecture makes it easy to add new email providers:

### SendGrid Adapter
```typescript
class SendGridProvider implements EmailProvider {
  async createDraft(subject, body, to) {
    // Use SendGrid personalization drafts API
  }
}
```

### AWS SES Adapter
```typescript
class SESProvider implements EmailProvider {
  async createDraft(subject, body, to) {
    // Use SES raw email API
  }
}
```

### Outlook/Microsoft Graph Adapter
```typescript
class GraphProvider implements EmailProvider {
  async createDraft(subject, body, to) {
    // Use Microsoft Graph /me/messages API
  }
}
```

---

## 🎯 Use Cases

### 1. HR Automated Reports
- Weekly status updates
- Onboarding checklists
- Performance review reminders

### 2. Operations Dashboards
- Daily shift handovers
- KPI summaries
- Incident reports

### 3. Finance Notifications
- Budget alerts
- Expense approvals
- Month-end closings

### 4. Developer Workflows
- Deployment notifications
- CI/CD status emails
- Monitoring alerts

---

## 📝 Migration Guide (v1.0 → v2.0)

If you're upgrading from the Apps Script version:

### Step 1: Update Config
```javascript
// v1.0
const config = {
  templateDocumentId: "..."
};
EmailEngine.generateEmailDraft("Morning_Status", config);

// v2.0 - Same API!
const config = {
  templateDocumentId: "..."
};
EmailEngine.generateEmailDraft("Morning_Status", config);
```

### Step 2: Update Library Reference
- v1.0: Library via Script ID
- v2.0: Import bundled `EmailEngine.gs` file

### Step 3: Test
```javascript
function testMigration() {
  const result = EmailEngine.generateEmailDraft('Morning_Status', {
    testMode: true,
    dryRun: true
  });
  Logger.log(result);
}
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas We Need Help:
- [ ] SendGrid adapter
- [ ] AWS SES adapter
- [ ] MJML template support
- [ ] React email preview component
- [ ] More unit tests

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Enayatullh**  
*Operations Engineer*

Built to solve real-world workflow automation challenges in Google Workspace environments.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/anomalyco/universal-email-automation/issues)
- **Discussions**: [GitHub Discussions](https://github.com/anomalyco/universal-email-automation/discussions)
- **Documentation**: [Wiki](https://github.com/anomalyco/universal-email-automation/wiki)

---

_Made with ❤️ for operations teams everywhere_
