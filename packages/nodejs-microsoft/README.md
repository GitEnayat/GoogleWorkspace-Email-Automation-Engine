# @universal-email/nodejs-microsoft

Microsoft 365 implementation of the Universal Email Automation Engine using Microsoft Graph API.

## Features

- ✅ **Outlook Mail** - Create and send email drafts via Microsoft Graph
- ✅ **OneDrive** - Load email templates from Word documents
- ✅ **Excel Online** - Read recipient data and configuration from Excel spreadsheets
- ✅ **Table Rendering** - Render Excel tables with formatting in emails
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Tested** - Comprehensive Jest unit tests

## Installation

```bash
npm install @universal-email/core @universal-email/nodejs-microsoft
```

## Quick Start

### 1. Set up Microsoft Graph Client

```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential } from '@azure/identity';

// Authenticate using Azure Identity
const credential = new DefaultAzureCredential();
const tokenProvider = async (scopes: string[]) => {
  const token = await credential.getToken(scopes.join(' '));
  return { token: token.token };
};

// Initialize Graph client
const graphClient = Client.init({
  authProvider: tokenProvider
});
```

### 2. Create Email Engine

```typescript
import { createNodeMicrosoftEmailEngine } from '@universal-email/nodejs-microsoft';

const engine = createNodeMicrosoftEmailEngine({
  graphClient,
  userEmail: 'you@company.com',
  logger: console
});
```

### 3. Generate Email Draft

```typescript
const result = await engine.generateEmailDraft('Monthly_Report');

console.log(`Draft created: ${result.draftId}`);
console.log(`Recipients: ${result.recipients.length}`);
```

## Configuration

The engine uses Excel Online spreadsheets for configuration:

### Template Document (Word)

Store email templates in OneDrive with this structure:

```
[SUBJECT]
Monthly Performance Report - {{DATE:Today}}

[BODY]
Good Morning,

Please find below the performance metrics.

$LINK:REPORT, TEXT:View Full Report$

[TO]
Manager, HR_Team

[CC]
admin@example.com
```

### Data Spreadsheet (Excel)

**Recipients Table:**
| Email | Role | Team | Department |
|-------|------|------|------------|
| john@company.com | Manager | Sales | APAC |

**Sender Profiles Table:**
| UserEmail | Name | Role | PrimaryEmail |
|-----------|------|------|--------------|
| you@company.com | John Doe | Manager | john@company.com |

**Link Registry Table:**
| Link_Key | Target_URL |
|----------|------------|
| POLICY | https://intranet.company.com/policy |
| REPORT | https://reports.company.com/monthly |

## API Reference

### `createNodeMicrosoftEmailEngine(config)`

Creates an email engine instance with Microsoft 365 services.

**Parameters:**
- `config.graphClient` - Microsoft Graph client instance
- `config.userEmail` - User's email address
- `config.logger` - Optional logger (defaults to console)

**Returns:** `EmailEngine` instance

### Available Tokens

Same as the Google version:

- `{{DATE:Today}}`, `{{DATE:Yesterday}}`, `{{DATE:Tomorrow}}`
- `{{DATE:Today+7}}`, `{{DATE:WeekStart}}`, `{{DATE:MonthStart}}`
- `{{RANGE:MonthStart:Today}}`
- `{{TIME}}`, `{{TIME:EST}}`, `{{TIME:PST}}`
- `{{MONTHNAME:0}}`, `{{MONTHNAME:-1}}`
- `{{GREETING}}`

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Files

- `NodeMicrosoftEmailProvider.test.ts` - Outlook Mail integration
- `NodeMicrosoftOneDriveTemplateLoader.test.ts` - Word template loading
- `NodeMicrosoftExcelDataStore.test.ts` - Excel data reading
- `NodeMicrosoftExcelTableRenderer.test.ts` - Table rendering

## Architecture

This package implements the core interfaces from `@universal-email/core`:

- `EmailProvider` → `NodeMicrosoftEmailProvider` (Outlook Mail)
- `TemplateLoader` → `NodeMicrosoftOneDriveTemplateLoader` (Word Online)
- `DataStore` → `NodeMicrosoftExcelDataStore` (Excel Online)
- `TableRenderer` → `NodeMicrosoftExcelTableRenderer` (Excel Online)

## Permissions Required

The following Microsoft Graph permissions are required:

- `Mail.ReadWrite` - Create and manage email drafts
- `Files.Read` - Read Word templates from OneDrive
- `Files.ReadWrite` - Read/write Excel data
- `User.Read` - Read user profile

## Limitations

- **Quotas**: Subject to Microsoft Graph API rate limits
- **Template Format**: Word documents (.docx) only
- **Data Source**: Excel Online (.xlsx) only
- **Authentication**: Requires Azure AD authentication

## Example: Full Workflow

```typescript
import { createNodeMicrosoftEmailEngine } from '@universal-email/nodejs-microsoft';
import { Client } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential } from '@azure/identity';

async function sendMonthlyReport() {
  // Initialize
  const credential = new DefaultAzureCredential();
  const graphClient = Client.init({
    authProvider: async (scopes) => {
      const token = await credential.getToken(scopes.join(' '));
      return { token: token.token };
    }
  });

  const engine = createNodeMicrosoftEmailEngine({
    graphClient,
    userEmail: 'manager@company.com'
  });

  // Generate draft
  const result = await engine.generateEmailDraft('Monthly_Report');

  console.log(`✓ Draft created in Outlook`);
  console.log(`✓ Recipients: ${result.recipients.length}`);
  console.log(`✓ Draft ID: ${result.draftId}`);
}

sendMonthlyReport().catch(console.error);
```

## Migration from Google Version

If you're migrating from `@universal-email/nodejs-google`:

1. Replace import: `@universal-email/nodejs-google` → `@universal-email/nodejs-microsoft`
2. Replace factory: `createNodeGoogleEmailEngine` → `createNodeMicrosoftEmailEngine`
3. Replace auth: Google OAuth2 → Azure AD authentication
4. Update templates: Google Docs → Word Online
5. Update data: Google Sheets → Excel Online

The core template syntax and token system remain the same.

## License

MIT
