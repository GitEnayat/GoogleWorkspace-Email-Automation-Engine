# Microsoft 365 Adapter for Universal Email Automation Engine

This package provides an adapter for the Universal Email Automation Engine, enabling robust integration with Microsoft 365 services such as Outlook for email operations, OneDrive for template storage, and Excel for data sourcing.

## Installation

To integrate the Microsoft 365 adapter, install the following packages:

```bash
npm install @universal-email/core @universal-email/nodejs-microsoft @microsoft/microsoft-graph-client @azure/identity
```

## Usage

### EmailEngine Factory

The `createNodeMicrosoftEmailEngine` function serves as the primary factory to obtain an `EmailEngine` instance specifically configured for Microsoft 365. It requires an initialized `graphClient` and optionally accepts a `userEmail` (if different from the authenticated user) and a custom `logger`.

```typescript
import { createNodeMicrosoftEmailEngine, MicrosoftAuthOptions } from '@universal-email/nodejs-microsoft';
import { EmailEngine, EmailConfig } from '@universal-email/core';
import { Client } from '@microsoft/microsoft-graph-client';
import { Logger } from '@universal-email/core'; // Assuming Logger is part of @universal-email/core

// Define your application's authentication context management
interface MyAuthContext {
  getGraphClient: () => Promise<Client>;
}

// Example of initializing the Microsoft Email Engine
async function initializeMicrosoftEngine(authContext: MyAuthContext): Promise<EmailEngine> {
  const graphClient: Client = await authContext.getGraphClient();

  const engine: EmailEngine = createNodeMicrosoftEmailEngine({
    graphClient,
    userEmail: 'authenticated-user@example.com', // Optional: Use if the `graphClient` is for a service principal
                                                // but you need to act on behalf of a specific user.
    // logger: myCustomLogger, // Provide an instance of Logger for detailed logging
  });

  return engine;
}
```

### Authentication

The `graphClient` configuration within `createNodeMicrosoftEmailEngine` requires a pre-initialized Microsoft Graph `Client` instance. This client handles all interactions with the Microsoft Graph API. Authentication for the `Client` typically involves using `DefaultAzureCredential` from `@azure/identity` to obtain access tokens.

#### Example Microsoft Graph Client Initialization

```typescript
import { Client, AuthProvider } from '@microsoft/microsoft-graph-client';
import { DefaultAzureCredential } from '@azure/identity';

// Configure your Azure AD application registration details.
// These typically come from environment variables or a configuration service.
const tenantId = process.env.AZURE_TENANT_ID || 'YOUR_AZURE_TENANT_ID';
const clientId = process.env.AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID';
const clientSecret = process.env.AZURE_CLIENT_SECRET || 'YOUR_AZURE_CLIENT_SECRET'; // For client credential flow

// Initialize the credential provider
const credential = new DefaultAzureCredential({
  tenantId,
  clientId,
  clientSecret,
});

// Define the required Microsoft Graph Permissions (scopes).
// These should be granted to your Azure AD application.
// For delegated permissions, ensure the user has consented.
// For application permissions (daemon apps), ensure they are granted by an administrator.
const requiredScopes = [
  'Mail.ReadWrite',         // Required for sending emails via Outlook.
  'Files.Read',            // Required for reading templates stored in OneDrive.
  'Files.ReadWrite',       // May be needed for temporary file operations (e.g., conversions).
  'User.Read',             // Basic permission to read user's profile.
];

// Create an authentication provider for the Graph client
const authProvider: AuthProvider = {
  getAccessToken: async () => {
    try {
      // Use the credential to get an access token for the required scopes.
      const tokenResponse = await credential.getToken(requiredScopes);
      return tokenResponse.token;
    } catch (error) {
      console.error('Error obtaining Microsoft Graph access token:', error);
      throw error;
    }
  },
};

// Initialize the Microsoft Graph Client with the authentication provider.
const graphClient: Client = Client.initWithMiddleware({
  authProvider,
});

// This 'graphClient' instance is then passed to 'createNodeMicrosoftEmailEngine'.
// For example:
// const engine = createNodeMicrosoftEmailEngine({ graphClient, userEmail: 'admin@yourorg.com' });
```

### Generating Email Drafts

The `EmailEngine` instance, once initialized, exposes the `generateEmailDraft` method. This method consumes an `EmailConfig` object, detailing the template, associated data, recipients, email subject, and control flags for email processing.

```typescript
import { EmailEngine, EmailConfig, EmailAction } from '@universal-email/core';

async function generateAndSendEmail(engine: EmailEngine) {
  const emailConfig: EmailConfig = {
    templateId: 'users/me/drive/items/onedrive-file-id-or-path', // Path or ID to your OneDrive Word/HTML template
    templateData: {
      customerName: 'Mr. John Smith',
      projectName: 'Website Redesign',
      deliveryDate: '2026-04-30',
      totalCost: '$5000',
    },
    recipients: {
      to: [{ name: 'John Smith', address: 'john.smith@example.com' }],
      cc: [],
      bcc: [{ name: 'Project Lead', address: 'lead@example.com' }],
    },
    subject: 'Project Update: {{projectName}} - Delivery by {{deliveryDate}}',
    dryRun: false, // If set to true, email content is generated, but no send/draft action occurs.
                   // Useful for debugging and content verification.
    testMode: false, // If true, the email subject or body might be prefixed with "TEST" or similar
                    // markers to clearly indicate it's a test email.
    emailAction: EmailAction.SEND, // Determines the action to be performed:
                                  // - SEND: Immediately sends the email through Outlook.
                                  // - DRAFT: Creates a draft email in the user's Outlook mailbox.
                                  // - RETURN_HTML: Returns only the generated HTML content and subject.
                                  // - RETURN_BODY_AND_SUBJECT: Returns the plain text body and subject.
  };

  try {
    const result = await engine.generateEmailDraft(emailConfig);
    console.log('Email operation completed:', result);
    // The structure of 'result' varies based on 'emailAction', e.g.,
    // { status: 'success', message: 'Email sent', emailId: 'outlook_message_id' }
  } catch (error) {
    console.error('Error during email generation or sending:', error);
  }
}
```

## Template Syntax

For comprehensive details on how to construct your OneDrive/Word document templates and the supported templating syntax, please refer to the main documentation:
[docs/TEMPLATE_SYNTAX.md](../../docs/TEMPLATE_SYNTAX.md)
Error executing tool write_file: Tool "write_file" not found. Did you mean one of: "read_file", "cli_help", "generalist"?
I need to write two files, but the `write_file` tool is not directly available to me. I will delegate this task to the `generalist` agent, as it has access to all tools.
[LocalAgentExecutor] Skipping subagent tool 'codebase_investigator' for agent 'generalist' to prevent recursion.
[LocalAgentExecutor] Skipping subagent tool 'cli_help' for agent 'generalist' to prevent recursion.
[LocalAgentExecutor] Skipping subagent tool 'generalist' for agent 'generalist' to prevent recursion.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 2s.. Retrying after 5300ms...
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 5s.. Retrying after 6896ms...
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 3s.. Retrying after 5930ms...
The `generalist` agent was interrupted. I need to re-issue the task to write the two README files, providing the content again.
[LocalAgentExecutor] Skipping subagent tool 'codebase_investigator' for agent 'generalist' to prevent recursion.
[LocalAgentExecutor] Skipping subagent tool 'cli_help' for agent 'generalist' to prevent recursion.
[LocalAgentExecutor] Skipping subagent tool 'generalist' for agent 'generalist' to prevent recursion.
The `generalist` agent failed. I'll attempt to use `write_file` directly for `packages/nodejs-google/README.md`, despite previous errors, in case tool availability has changed.
Error executing tool write_file: Tool "write_file" not found. Did you mean one of: "read_file", "cli_help", "generalist"?
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 1s.. Retrying after 5945ms...
I cannot directly write files, and the `generalist` sub-agent failed. I will provide the content for both README files in Markdown format for manual creation.`write_file` is unavailable, and `generalist` failed. I cannot write the READMEs. I will inform the user and provide the content for manual creation.
