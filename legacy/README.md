# Universal Email Automation Engine

[![Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-blue)](https://developers.google.com/apps-script)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Tired of copying data from Sheets into emails every morning? This engine connects your Google Docs templates with live Sheet data to generate formatted Gmail drafts automatically. Built for teams who spend too much time on manual reporting.

---

### Why this exists

I started this as a simple script in one spreadsheet. Then another report and another. Soon I had many copies of the same code with hardcoded emails for different reports, links, and dates scattered everywhere. Updating one template meant hunting down files and breaking things.

This engine solves that by separating **what changes** (templates, recipients, links) from **what doesn't** (the logic). Now non-technical teammates can edit templates in Google Docs and manage recipient lists in Sheets without touching code.

### What it does

- **Centralizes templates** - Edit email content in Google Docs (no code)
- **Centralizes data** - Recipients, links, and settings live in Sheets
- **Standardizes output** - Same formatting every time, no copy-paste errors
- **Saves time** - What took 15 minutes now takes 1 click

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

## 📦 Using as a Library (Recommended)

Install this engine as a **Library** to use it across multiple Google Sheets without duplicating code.`

### Step 1: Deploy as Library

1. Open the Apps Script project containing this engine
2. Click **Deploy > New deployment**
3. Select type: **Library**
4. Click **Deploy**
5. Copy the **Script ID** (you'll need this)

### Step 2: Add Library to Your Spreadsheet

1. Open your spreadsheet (e.g., "HR Reports")
2. Go to **Extensions > Apps Script**
3. Click **Libraries +** (left sidebar)
4. Paste the Script ID from Step 1
5. Select latest version and click **Add**

### Step 3: Write Runner Code

Create a simple function in your spreadsheet's script:

```javascript
/**
 * @OnlyCurrentDoc
 */
function sendMorningReport() {
  // Call the library (default identifier is 'EmailEngine')
  EmailEngine.generateEmailDraft("Morning_Status", {
    testMode: false
  });
}

function testBeforeDeploy() {
  // Safety check - sends to you only
  EmailEngine.generateEmailDraft("Morning_Status", {
    testMode: true,
    action: "DRY_RUN"
  });
}
```

### Benefits of Library Approach

- ✅ **Single source of truth** - Update engine once, all spreadsheets benefit
- ✅ **No code duplication** - Each spreadsheet only has runner functions
- ✅ **Easy maintenance** - Fix bugs in one place
- ✅ **Version control** - Pin specific versions or use latest

---

## 📁 Project Structure

```
src/
├── EmailEngine.js        # Main orchestration (entry point)
├── TemplateService.js    # Template parsing, date tokens, table rendering
├── ContentManager.js     # CMS links, recipients, signature generation
└── TemplateValidator.js  # Pre-flight template validation
```

---

## 🚀 Quick Start (Single Project)

If you just want to use this in one spreadsheet (not as a library):

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Copy all 4 files from `src/` into the script editor
4. Update the `CONFIG` object in `EmailEngine.js`:

```javascript
const CONFIG = {
  templateDocumentId: "YOUR_TEMPLATE_DOC_ID",
  directorySheetId: "YOUR_DIRECTORY_SHEET_ID",
  linkRepositorySheetId: "YOUR_LINK_SHEET_ID",
  logoFileId: "YOUR_LOGO_FILE_ID"
};
```

Then use:
```javascript
generateEmailDraft("Monthly_Report");
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

- **Execution time**: 6-minute Apps Script limit
- **Gmail quotas**: Workspace: 1,500/day | Consumer: 100/day
- **Cache limit**: 100KB for logo caching
- **Internal use only**: Not for bulk marketing

---

## 🔐 Permissions Required

When you first run this, Google will request:
- **Gmail** - Create and manage drafts
- **Google Docs** - Read templates
- **Google Sheets** - Read data and config
- **Google Drive** - Access logo files

Everything runs in your Google Workspace. No data leaves Google's servers.

---

_License: MIT_
