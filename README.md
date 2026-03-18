# Universal Email Automation Engine

[![Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-blue)](https://developers.google.com/apps-script)
[![Microsoft 365](https://img.shields.io/badge/Platform-Microsoft%20365-0078D4)](https://learn.microsoft.com/graph/)
[![Node.js](https://img.shields.io/badge/Node.js-TypeScript-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-Jest-green)](https://jestjs.io/)

> Tired of copying data from Sheets/Excel into emails every morning? This engine connects your templates with live data to generate formatted email drafts automatically. Built for teams who spend too much time on manual reporting.

**Note:** Official mail merge samples use basic `{{placeholder}}` replacement. This engine goes further - full templates with tables, formatting, managed links, and date logic.

---

### Why this exists

I started this as a simple script in one spreadshee then another reports then another. Soon I had 10 copies of the same code with hardcoded emails, links, and dates scattered everywhere. Updating one template meant hunting down files and breaking things.

This engine solves that by separating **what changes** (templates, recipients, links) from **what doesn't** (the logic). Now non-technical teammates can edit templates in Google Docs and manage recipient lists in Sheets without touching code.

### What it does

- **Centralizes templates** - Edit email content in Google Docs (no code)
- **Centralizes data** - Recipients, links, and settings live in Sheets
- **Standardizes output** - Same formatting every time, no copy-paste errors
- **Saves time** - What took 15 minutes now takes 1 click

### What it's NOT

- Not for marketing emails (use Mailchimp)
- Not a SaaS product - runs in your Google Workspace or server
- Not replacing judgment - still review drafts before sending
- Not a marketplace add-on - it's your code, your control

---

## 💡 How teams use this

Most teams already live in Google Workspace - Docs for content, Sheets for data, Gmail for sending. The problem is they don't talk to each other. You end up copying tables from Sheets, pasting into Docs, then into Gmail. Formatting breaks. Links go stale. Someone gets left off the email.

This engine bridges that gap:

**Before:**
1. Open performance report Sheet
2. Copy the table
3. Open Gmail draft from yesterday
4. Paste table (formatting breaks)
5. Update the date manually
6. Check if the recipient list is current
7. Send

**After:**
1. Click button in Sheet
2. Review draft (already formatted, correct date, right people)
3. Send

The engine handles the tedious parts. Your team focuses on the actual content.

---

## 📦 Three Versions: Pick Your Use Case

### 1. Google Apps Script Version (Production)

**Best for:** Teams using Google Workspace who want zero setup

- ✅ Runs directly in Google Sheets
- ✅ No build steps, no dependencies
- ✅ Non-technical users can maintain
- ✅ Free, no server costs

**Location:** [`/legacy`](/legacy)

```javascript
// Just call from your Sheet's script editor
generateEmailDraft("Morning_Status");
```

### 2. Node.js + Google Workspace (Advanced)

**Best for:** Advanced deployments, Cloud Functions, CI/CD, higher quotas

- ✅ No 6-minute timeout limit
- ✅ Higher sending quotas
- ✅ Integrate with external APIs
- ✅ Unit testing with Jest
- ✅ Better error handling & monitoring
- ✅ Deploy to Cloud Functions, Vercel, servers

**Location:** [`packages/nodejs-google`](/packages/nodejs-google)

```typescript
// Use in Node.js applications
import { createNodeGoogleEmailEngine } from '@universal-email/nodejs-google';

const engine = createNodeGoogleEmailEngine({ auth, userEmail });
await engine.generateEmailDraft('Morning_Status');
```

### 3. Node.js + Microsoft 365

**Best for:** Teams using Microsoft 365 / Outlook

- ✅ Outlook Mail integration via Microsoft Graph
- ✅ OneDrive for template storage (Word documents)
- ✅ Excel Online for data and recipient management
- ✅ Unit testing with Jest
- ✅ Same architecture as Google version

**Location:** [`packages/nodejs-microsoft`](/packages/nodejs-microsoft)

```typescript
// Use in Node.js applications
import { createNodeMicrosoftEmailEngine } from '@universal-email/nodejs-microsoft';

const engine = createNodeMicrosoftEmailEngine({ graphClient, userEmail });
await engine.generateEmailDraft('Morning_Status');
```

### Version Comparison

| Feature | Apps Script | Node.js (Google) | Node.js (Microsoft) |
|---------|-------------|------------------|---------------------|
| Setup | Copy-paste | npm install | npm install |
| Platform | Google Workspace | Google Workspace | Microsoft 365 |
| Email | Gmail Drafts | Gmail API | Outlook Mail |
| Templates | Google Docs | Google Docs | Word Documents |
| Data Source | Google Sheets | Google Sheets | Excel Online |
| Timeout | 6 min | Unlimited | Unlimited |
| Quotas | 1,500/day | Higher limits | Graph API limits |
| Testing | Manual | Jest unit tests | Jest unit tests |
| Deployment | In Sheet | Cloud Functions, servers | Cloud Functions, servers |
| Best for | Internal teams | Production systems | Microsoft 365 teams |

**Start with Apps Script** if you're in Google Workspace. **Move to Node.js** when you hit limits or need advanced features. **Choose Microsoft** if your team uses Microsoft 365.

---

## 🚀 Quick Start (Apps Script)

### 1. Copy Files

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Copy all 4 files from [`/legacy`](/legacy) into the script editor
4. Update the `CONFIG` object:

```javascript
const CONFIG = {
  templateDocumentId: "YOUR_TEMPLATE_DOC_ID",
  directorySheetId: "YOUR_DIRECTORY_SHEET_ID",
  linkRepositorySheetId: "YOUR_LINK_SHEET_ID",
  logoFileId: "YOUR_LOGO_FILE_ID"
};
```

### 2. Use It

```javascript
// Create a draft
generateEmailDraft("Monthly_Report");

// Send directly
generateEmailDraft("Monthly_Report", { action: "SEND" });

// Test mode (sends to you only)
generateEmailDraft("Monthly_Report", { testMode: true });
```

---

## 📦 Installation (Node.js)

### Google Workspace

```bash
npm install @universal-email/core @universal-email/nodejs-google
```

```typescript
import { createNodeGoogleEmailEngine } from '@universal-email/nodejs-google';
import { google } from 'googleapis';

// Initialize with OAuth2
const auth = new google.auth.OAuth2(...);
const engine = createNodeGoogleEmailEngine({ auth, userEmail: 'you@company.com' });

// Generate draft
const result = await engine.generateEmailDraft('Monthly_Report');
```

### Microsoft 365

```bash
npm install @universal-email/core @universal-email/nodejs-microsoft
```

```typescript
import { createNodeMicrosoftEmailEngine } from '@universal-email/nodejs-microsoft';
import { Client } from '@microsoft/microsoft-graph-client';

// Initialize with Graph client
const graphClient = Client.init({ authProvider: ... });
const engine = createNodeMicrosoftEmailEngine({ graphClient, userEmail: 'you@company.com' });

// Generate draft
const result = await engine.generateEmailDraft('Monthly_Report');
```

---

## 📋 Configuration

| Property | Description | Example |
|----------|-------------|---------|
| `templateDocumentId` | Google Doc with email templates | `"1abc...xyz"` |
| `directorySheetId` | Spreadsheet with recipient data | `"1def...uvw"` |
| `recipientsTabName` | Tab for recipient directory | `"Recipients_Master"` |
| `senderProfilesTabName` | Tab for sender signatures | `"Sender_Profiles"` |
| `recipientEmailColumn` | Column header for emails | `"Email"` |
| `recipientTagColumns` | Columns for tag lookup | `["Role", "Team"]` |
| `linkRepositorySheetId` | Spreadsheet for CMS links | `"1ghi...rst"` |
| `linkRepositoryTabName` | Tab for link repository | `"Link_Registry"` |
| `linkKeyColumn` | Column header for link keys | `"Link_Key"` |
| `linkUrlColumn` | Column header for URLs | `"Target_URL"` |
| `logoFileId` | Drive file ID for logo | `"1jkl...opq"` |
| `signatureTemplateTab` | Tab for signature template | `"Signature_Template"` |
| `logsTabName` | Tab for execution logs | `"System_Logs"` |
| `defaultAction` | Default: `"DRAFT"` or `"SEND"` | `"DRAFT"` |

---

## 📝 Template Format (Google Docs)

Create templates in Google Docs with this structure:

```
[SUBJECT]
Monthly Performance Report - {{DATE:Today}}

[BODY]
Good Morning,

Please find below the performance metrics for {{RANGE:MonthStart:Today}}.

$LINK:REPORT, TEXT:View Full Report$

[TO]
Manager, HR_Team

[CC]
admin@example.com
```

### Supported Sections

| Tag | Description | Required |
|-----|-------------|----------|
| `[SUBJECT]` | Email subject line | Yes |
| `[BODY]` | Email body content | Yes |
| `[TO]` | Recipients (tags or emails) | No* |
| `[CC]` | CC recipients | No |

*At least TO or CC must be present

---

## 🔤 Date/Time Tokens

| Token | Example Output |
|-------|----------------|
| `{{DATE:Today}}` | 18-Mar-2026 |
| `{{DATE:Yesterday}}` | 17-Mar-2026 |
| `{{DATE:Tomorrow}}` | 19-Mar-2026 |
| `{{DATE:Today+7}}` | 25-Mar-2026 |
| `{{DATE:WeekStart}}` | 15-Mar-2026 |
| `{{DATE:MonthStart}}` | 01-Mar-2026 |
| `{{RANGE:MonthStart:Today}}` | 01-Mar-2026 - 18-Mar-2026 |
| `{{TIME}}` | 14:30 MYT |
| `{{TIME:BKK}}` | 13:30 ICT |
| `{{MONTHNAME:0}}` | March 2026 |
| `{{MONTHNAME:-1}}` | February 2026 |
| `{{DATE_FORMAT:Today:dd/MM/yyyy}}` | 18/03/2026 |
| `{{GREETING}}` | Good Morning/Afternoon/Evening |

---

## 🔗 CMS Link Tags

Manage links centrally in a spreadsheet:

**Spreadsheet structure:**
| Link_Key | Target_URL |
|----------|------------|
| POLICY | https://... |
| HANDBOOK | https://... |

**Usage:**
```
$LINK:POLICY, TEXT:Company Policy$
```

**Result:**
```html
<a href="https://...">Company Policy</a>
```

---

## 📊 Embedded Tables

Insert live Sheet data into emails:

**Usage:**
```
[Table] Sheet: https://docs.google.com/spreadsheets/d/ABC123, range: 'Sheet1'!A1:D10
```

Features:
- Preserves formatting (colors, fonts, alignment)
- Supports merged cells
- Auto-trims empty rows

---

## 👥 Recipient Management

**Distribution List Spreadsheet:**
| Email | Role | Team | Department |
|-------|------|------|------------|
| john@example.com | Manager | Sales | APAC |

**Usage:**
```
[TO]
Manager, HR_Team, john@example.com
```

**Sender Signature Spreadsheet:**
| UserEmail | Name | Role | PrimaryEmail |
|-----------|------|------|--------------|
| you@example.com | John Doe | Manager | john@example.com |

**Signature Template:**
```
{{Sender_Name}}
{{Sender_Role}}
{{Signature_Logo}}
```

---

## ✅ Template Validation

```javascript
// Validate before using
const result = validateTemplate("Monthly_Report");
if (!result.valid) {
  Logger.log("Errors: " + result.errors.join(", "));
}
```

---

## 🧪 Testing & Debugging

```javascript
// Dry run - see what would happen
generateEmailDraft("Monthly_Report", { action: "DRY_RUN" });

// Test mode - sends to you only
generateEmailDraft("Monthly_Report", { testMode: true });

// Override config
generateEmailDraft("Monthly_Report", {
  templateDocumentId: "alternative_doc_id"
});
```

---

## 📜 Execution Logs

All runs are logged to `System_Logs` sheet: Timestamp, User, Template, Status, Draft ID, Recipients, Duration.

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Template not found" | Check tab name, verify `templateDocumentId`, ensure Doc is shared |
| "Tab not found" | Check tab names in `CONFIG` match your spreadsheet |
| [MISSING LINK] | Check `Link_Key` matches in template and spreadsheet |
| Tables not rendering | Verify Sheet URL and range: `'SheetName'!A1:D10` |
| Signature not appearing | Check `senderProfilesTabName`, verify `UserEmail` matches |

---

## ⚠️ Limitations & Quotas

### Apps Script Version
- **Execution time**: 6-minute limit per run
- **Gmail quotas**: Workspace: 1,500/day | Consumer: 100/day
- **Cache limit**: 100KB for logo caching

### Node.js Version
- **Execution time**: No limit (depends on deployment)
- **Gmail quotas**: Higher limits with Google Cloud
- **Cache**: Configurable (Redis, Memory, etc.)

---

## 🔐 Permissions Required

When you first run this, Google will request:
- **Gmail** - Create and manage drafts
- **Google Docs** - Read templates
- **Google Sheets** - Read data and config
- **Google Drive** - Access logo files

Everything runs in your Google Workspace. No data leaves Google's servers.

---

## 🏗️ Architecture (Node.js Version)

The Node.js version uses clean TypeScript interfaces for maintainability and testability:

```
┌─────────────────────────────────────┐
│  Your Application                    │
├─────────────────────────────────────┤
│  @universal-email/core               │
│  - EmailEngine (orchestration)       │
│  - Types & Interfaces                │
├─────────────────────────────────────┼─────────────────┤
│  Platform Implementations             │
├─────────────────────────────────────┼─────────────────┤
│  @universal-email/nodejs-google      │  @universal-email/nodejs-microsoft
│  - Gmail API                         │  - Outlook Mail (Graph API)
│  - Google Docs                       │  - Word Online (OneDrive)
│  - Google Sheets                     │  - Excel Online
│  - Google Drive                      │
└─────────────────────────────────────┴─────────────────┘
```

### Why This Design?

1. **Separation of Concerns** - Core logic independent of platform APIs
2. **Testability** - Mock interfaces for unit tests (Jest)
3. **Type Safety** - TypeScript catches errors at compile time
4. **Extensibility** - Multiple platform implementations (Google, Microsoft)

Most mail merge scripts keep everything in one file. This structure makes it easier to test, extend, and deploy to different environments.

### Package Structure

```
packages/
├── core/                    # Platform-agnostic orchestration
├── nodejs-google/           # Google Workspace implementation
└── nodejs-microsoft/        # Microsoft 365 implementation
```

### Core Interfaces

The `@universal-email/core` package defines clean interfaces:

- `EmailProvider` - Send/save emails (Gmail, Outlook)
- `TemplateLoader` - Load templates (Google Docs, Word)
- `DataStore` - Read structured data (Sheets, Excel)
- `TableRenderer` - Render tables with formatting

Each platform package implements these interfaces using native APIs.

---

## 🧪 Testing

The Node.js packages include comprehensive unit tests using Jest:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific package
npm test -w @universal-email/core
npm test -w @universal-email/nodejs-google
npm test -w @universal-email/nodejs-microsoft
```

### Test Coverage

- **Core Package**: Email engine orchestration, template parsing, date/time logic
- **Google Package**: Gmail API, Google Docs, Sheets integration
- **Microsoft Package**: Outlook Mail, Word Online, Excel Online integration

### Running Tests

```bash
# Core package tests
cd packages/core && npm test

# Google package tests
cd packages/nodejs-google && npm test

# Microsoft package tests
cd packages/nodejs-microsoft && npm test
```

---

## 👤 Author

**Enayatullh** | Operations Engineer

Built to eliminate manual reporting toil in WFM teams. This project demonstrates:
- **Google Apps Script** - Production automation in Workspace
- **Node.js & TypeScript** - Modular, type-safe system design
- **System Architecture** - Separation of concerns, dependency injection
- **Microsoft 365** - Graph API integration (Outlook, OneDrive, Excel Online)
- **Testing** - Jest unit tests for maintainability
- **Real-world Problem Solving** - Solving actual pain points, not imaginary ones

---

## 📄 License

MIT License
