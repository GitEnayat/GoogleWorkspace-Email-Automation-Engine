# Migration Guide: v1.0 (Apps Script) → v2.0 (Node.js/TypeScript)

This guide explains how the Apps Script adapter works and how to use it.

---

## How the Apps Script Adapter Works

### The Challenge

Apps Script has **no module system** - you can't use `require()` or `import`. All code must be in a single file or use Google's proprietary library system.

### The Solution

We use **esbuild** to bundle everything into a single `.gs` file:

```
TypeScript Source Files          Bundled Output
┌─────────────────────┐
│ core/               │
│  - EmailEngine.ts   │
│  - types/index.ts   │         ┌──────────────────────────┐
│  - providers/       │         │                          │
├─────────────────────┤         │  EmailEngine.gs          │
│ apps-script-adapter/│  ────→  │  (Single bundled file    │
│  - index.ts         │         │   with all dependencies) │
│  - providers/*.ts   │         │                          │
└─────────────────────┘         └──────────────────────────┘
        │                                   │
        │  npm run build                    │  Copy to Apps Script
        ▼                                   ▼
```

### Build Process

```json
// packages/apps-script-adapter/package.json
{
  "scripts": {
    "build": "npm run build:ts && npm run build:bundle",
    "build:ts": "tsc",
    "build:bundle": "esbuild dist/index.js --bundle --outfile=dist/EmailEngine.gs --format=iife --global-name=EmailEngine"
  }
}
```

This:
1. Compiles TypeScript to JavaScript
2. Bundles all dependencies into one file
3. Wraps in IIFE (Immediately Invoked Function Expression)
4. Exposes `EmailEngine` global object to Apps Script

---

## Using the Adapter in Apps Script

### Step 1: Build the Adapter

```bash
cd packages/apps-script-adapter
npm install
npm run build
```

Output: `dist/EmailEngine.gs`

### Step 2: Copy to Apps Script

1. Open your Google Apps Script project
2. Create a new file: `EmailEngine.gs`
3. Copy contents from `dist/EmailEngine.gs`
4. Create your runner file: `Code.gs`

### Step 3: Create Wrapper Functions

```javascript
// Code.gs
function sendMorningReport() {
  const config = {
    templateDocumentId: '1234567890abcdef...',
    directorySheetId: '9876543210zyxwv...',
    emailAction: 'DRAFT'
  };
  
  // Call the bundled engine
  const result = EmailEngine.generateEmailDraft('Morning_Status', config);
  
  Logger.log(`Draft created: ${result.draftId}`);
  return result;
}

function sendWeeklyReport() {
  EmailEngine.generateEmailDraft('Weekly_Report', {
    emailAction: 'SEND'
  });
}

function testBeforeDeploy() {
  EmailEngine.generateEmailDraft('Morning_Status', {
    testMode: true,
    dryRun: true
  });
}
```

### Step 4: Run

1. Click **Run** in Apps Script editor
2. Grant permissions when prompted
3. Check logs: **View → Executions**

---

## Using with clasp (Recommended for Development)

### Setup

```bash
# Install clasp globally
npm install -g @google/clasp

# Login
clasp login

# In your Apps Script project folder
clasp clone <your-script-id>

# Copy the bundled file
cp ../universal-email-automation/packages/apps-script-adapter/dist/EmailEngine.gs .

# Push to Apps Script
clasp push
```

### Workflow

```bash
# Edit code locally
vim Code.gs

# Push changes
clasp push

# Run remotely
clasp run sendMorningReport
```

---

## API Reference

### `generateEmailDraft(templateName, config)`

Main function to generate an email draft.

**Parameters:**
- `templateName` (string): Name of the template in your Google Doc
- `config` (object, optional): Configuration overrides

**Config Options:**
```typescript
{
  // Template source
  templateDocumentId?: string;
  
  // Data source
  directorySheetId?: string;
  recipientsTabName?: string;
  
  // Recipient resolution
  recipientEmailColumn?: string;  // Default: 'Email'
  recipientTagColumns?: string[]; // Default: ['Role', 'Team', 'Department']
  
  // Link repository
  linkRepositorySheetId?: string;
  linkRepositoryTabName?: string; // Default: 'Link_Registry'
  
  // Execution mode
  dryRun?: boolean;    // Log only, no drafts
  testMode?: boolean;  // Send to current user only
  
  // Action
  emailAction?: 'DRAFT' | 'SEND';  // Default: 'DRAFT'
  
  // Logging
  logsTabName?: string;  // Default: 'System_Logs'
}
```

**Returns:**
```typescript
{
  success: boolean;
  draftId?: string;
  draftIds?: string[];
  recipientCount: number;
  mode: 'PROD' | 'TEST' | 'DRY_RUN';
  duration: number;  // milliseconds
  error?: string;
}
```

### `generateBatchDrafts(templateNames, config)`

Generate multiple drafts in one execution.

**Parameters:**
- `templateNames` (string[]): Array of template names
- `config` (object): Same as above

**Returns:**
```typescript
ExecutionResult[]  // Array of results for each template
```

### `testEmailDraft(templateName)`

Helper for quick testing (sets `testMode: true` and `dryRun: true`).

---

## Example Configurations

### HR Weekly Report

```javascript
function sendWeeklyHRReport() {
  EmailEngine.generateEmailDraft('Weekly_HR_Status', {
    templateDocumentId: '1ABC123...',
    directorySheetId: '2DEF456...',
    recipientsTabName: 'HR_Team',
    emailAction: 'DRAFT'
  });
}
```

### Operations Daily Digest (Auto-Send)

```javascript
function sendDailyOpsDigest() {
  EmailEngine.generateEmailDraft('Daily_Ops', {
    templateDocumentId: '3GHI789...',
    directorySheetId: '4JKL012...',
    emailAction: 'SEND'  // Sends immediately
  });
}
```

### Developer Testing

```javascript
function testTemplate() {
  const result = EmailEngine.generateEmailDraft('New_Template', {
    templateDocumentId: '5MNO345...',
    directorySheetId: '6PQR678...',
    testMode: true,   // Sends to you
    dryRun: true      // Actually, don't send anything
  });
  
  Logger.log(JSON.stringify(result));
}
```

---

## Troubleshooting

### "EmailEngine is not defined"

**Cause:** Bundled file not loaded properly.

**Solution:**
1. Ensure `EmailEngine.gs` is in your project
2. Check it has `/** @OnlyCurrentDoc */` banner
3. Verify the file is saved

### "Template not found"

**Cause:** Template name doesn't match Google Doc.

**Solution:**
1. Check template name spelling
2. Verify the Google Doc ID is correct
3. Ensure template section exists in Doc

### "No valid recipients found"

**Cause:** Directory Sheet configuration issue.

**Solution:**
1. Check Sheet ID and tab name
2. Verify column headers match config
3. Ensure at least one recipient has an email

### Execution Timeout

**Cause:** Batch too large (>6 minutes).

**Solution:**
1. Split into smaller batches
2. Use `generateBatchDrafts()` which has built-in time checks
3. Consider time-based triggers for large batches

---

## Advanced: Custom Providers

Want to extend functionality? Implement your own providers:

```typescript
// Custom email provider with logging
class LoggedEmailProvider extends GoogleAppsEmailProvider {
  async createDraft(subject, body, to, cc, bcc) {
    Logger.log(`Creating draft: ${subject}`);
    Logger.log(`To: ${to.join(', ')}`);
    return super.createDraft(subject, body, to, cc, bcc);
  }
}
```

---

## Next Steps

1. **Build the adapter**: `npm run build`
2. **Copy to Apps Script**: Copy `dist/EmailEngine.gs`
3. **Create wrapper functions**: See examples above
4. **Test**: Run with `testMode: true` first
5. **Deploy**: Set up time-based triggers if needed

---

## Support

- **Issues**: https://github.com/anomalyco/universal-email-automation/issues
- **Discussions**: https://github.com/anomalyco/universal-email-automation/discussions
