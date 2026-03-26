# Universal Email Automation Engine

[![Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-blue)](https://developers.google.com/apps-script)
[![Node.js](https://img.shields.io/badge/Node.js-TypeScript-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This engine connects email templates with live data to automatically generate formatted email drafts, reducing manual effort and standardizing recurring communication.

### Why This Exists

This project originated from a common problem: duplicated scripts across multiple spreadsheets, each with hardcoded emails, links, and dates. Updating one template meant hunting down every copy. The engine solves this by separating dynamic content (templates, recipients, links) from core logic — non-technical teammates can edit templates in Google Docs and manage recipient lists in Sheets without touching code.

### What it does

- Centralizes templates — Edit email content in Google Docs or Word
- Centralizes data — Recipients, links, and settings live in Sheets or Excel
- Standardizes output — Consistent formatting, no copy-paste errors

### What it's NOT

- Not for marketing emails (use Mailchimp)
- Not a SaaS product — runs in your Google Workspace or server
- Not replacing judgment — still review drafts before sending
- Not a marketplace add-on — it's your code, your control

### Workflow Example

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

---

## Three Versions: Pick Your Use Case

| Version | Best for | Location |
|---------|----------|----------|
| Google Apps Script | Zero-setup, runs inside Google Sheets, no build needed | [`/legacy`](/legacy) |
| Node.js + Google | Cloud Functions, CI/CD, higher quotas, unit-testable | [`packages/nodejs-google`](/packages/nodejs-google) |
| Node.js + Microsoft 365 | Outlook / Graph API / Excel / OneDrive | [`packages/nodejs-microsoft`](/packages/nodejs-microsoft) |

---

## Quick Start (Apps Script)

1. Open your Google Sheet → **Extensions > Apps Script**
2. Copy all 4 files from [`/legacy`](/legacy) into the script editor
3. Update the `CONFIG` object:

```javascript
const CONFIG = {
  templateDocumentId: "YOUR_TEMPLATE_DOC_ID",
  directorySheetId:   "YOUR_DIRECTORY_SHEET_ID",
  linkRepositorySheetId: "YOUR_LINK_SHEET_ID",
};
```

4. Call it:

```javascript
generateEmailDraft("Monthly_Report");                    // creates draft
generateEmailDraft("Monthly_Report", { action: "SEND" }); // sends directly
generateEmailDraft("Monthly_Report", { testMode: true }); // sends to you only
```

---

## Package Structure

```
packages/
├── core/              # Platform-agnostic engine — no platform deps
├── nodejs-google/     # Google Workspace (Gmail API, Sheets, Docs)
└── nodejs-microsoft/  # Microsoft 365 (Graph API, Outlook, Excel)
```

For template syntax see [TEMPLATE_SYNTAX](docs/TEMPLATE_SYNTAX.md).

---

## License

MIT
