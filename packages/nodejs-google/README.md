# Google Workspace Adapter for Universal Email Automation Engine

This package provides an adapter for the Universal Email Automation Engine, enabling seamless integration with Google Workspace services such as Gmail for sending, Google Docs for templating, and Google Sheets for data sourcing.

## Installation

To integrate the Google Workspace adapter, install the following packages:

```bash
npm install @universal-email/core @universal-email/nodejs-google googleapis
```

## Usage

### EmailEngine Factory

The `createNodeGoogleEmailEngine` function serves as the primary factory to obtain an `EmailEngine` instance specifically configured for Google Workspace. It requires authentication credentials and optionally accepts a `userEmail` for impersonation (especially with service accounts) and a custom `logger`.

```typescript
import { createNodeGoogleEmailEngine, GoogleAuthOptions } from '@universal-email/nodejs-google';
import { EmailEngine, EmailConfig } from '@universal-email/core';
import { OAuth2Client, GoogleAuth } from 'googleapis-common'; // From 'googleapis' package, specifically 'googleapis-common' for types.
import { Logger } from '@universal-email/core'; // Assuming Logger is part of @universal-email/core

// Define your application's authentication context management
interface MyAuthContext {
  getOAuth2Client: () => Promise<OAuth2Client>;
  getServiceAccountAuth: () => Promise<GoogleAuth>;
}

// Example of initializing the Google Email Engine
async function initializeGoogleEngine(authContext: MyAuthContext): Promise<EmailEngine> {
  // Option 1: User Authentication Flow (OAuth2Client)
  // This is suitable for applications where users grant permission to access their Google data.
  const oauth2Client: OAuth2Client = await authContext.getOAuth2Client();
  const userBasedEngine: EmailEngine = createNodeGoogleEmailEngine({
    auth: { oauth2Client },
    userEmail: 'authenticated-user@example.com', // Typically the email of the user who authorized
    // logger: myCustomLogger, // Provide an instance of Logger for detailed logging
  });

  // Option 2: Service Account Authentication Flow (GoogleAuth)
  // Ideal for server-to-server interactions where the application acts on behalf of a user
  // without direct user interaction (e.g., batch processing).
  const serviceAccountAuth: GoogleAuth = await authContext.getServiceAccountAuth();
  const serviceAccountEngine: EmailEngine = createNodeGoogleEmailEngine({
    auth: { googleAuth: serviceAccountAuth },
    userEmail: 'impersonated-user@example.com', // Crucial: email of the user to impersonate
    // logger: myCustomLogger,
  });

  // Depending on your application's requirements, return the appropriate engine.
  // For most interactive applications, user-based authentication is common.
  return userBasedEngine;
}
```

### Authentication

The `auth` configuration within `createNodeGoogleEmailEngine` expects an object containing either an `OAuth2Client` for user-based authentication or a `GoogleAuth` instance for service account authentication. It is critical to configure these correctly to ensure the engine has the necessary permissions.

#### Required Google API Scopes

For full functionality, ensure your Google Cloud project and authentication credentials include the following OAuth 2.0 scopes:
- `https://mail.google.com/`: Grants full access to Gmail mailboxes, necessary for sending and drafting emails.
- `https://www.googleapis.com/auth/spreadsheets.readonly`: Allows read-only access to Google Sheets, used for data sourcing.
- `https://www.googleapis.com/auth/documents.readonly`: Permits read-only access to Google Docs, used for retrieving email templates.

### Generating Email Drafts

The `EmailEngine` instance, once initialized, provides the `generateEmailDraft` method. This method takes an `EmailConfig` object, which specifies the template, data, recipients, subject, and various operational flags.

```typescript
import { EmailEngine, EmailConfig, EmailAction } from '@universal-email/core';

async function generateAndSendEmail(engine: EmailEngine) {
  const emailConfig: EmailConfig = {
    templateId: 'your-google-doc-id-or-path', // Unique identifier or path to your Google Docs template
    templateData: {
      recipientName: 'Dr. Jamie Doe',
      conference: 'AI Innovations Summit',
      date: 'April 15, 2026',
      ticketLink: 'https://example.com/ticket/12345',
    },
    recipients: {
      to: [{ name: 'Jamie Doe', address: 'jamie.doe@example.com' }],
      cc: [{ name: 'Support', address: 'support@example.com' }],
      bcc: [],
    },
    subject: 'Your Ticket for the {{conference}} on {{date}}',
    dryRun: false, // If true, the email content is generated but no action (send/draft) is performed.
                   // Useful for previewing emails.
    testMode: false, // If true, a "TEST MODE" prefix might be added to the subject or body,
                    // depending on engine implementation, to distinguish test emails.
    emailAction: EmailAction.SEND, // Specifies the desired action:
                                  // - SEND: Immediately sends the email.
                                  // - DRAFT: Creates a draft in Gmail.
                                  // - RETURN_HTML: Returns the generated HTML content and subject.
                                  // - RETURN_BODY_AND_SUBJECT: Returns parsed body and subject as text.
  };

  try {
    const result = await engine.generateEmailDraft(emailConfig);
    console.log('Email operation completed:', result);
    // Expected result structure depends on EmailAction, e.g.,
    // { status: 'success', message: 'Email sent successfully', emailId: 'message_id_string' }
  } catch (error) {
    console.error('Error during email generation or sending:', error);
  }
}
```

## Template Syntax

For detailed information on how to structure your Google Docs templates and the supported templating syntax, please refer to the dedicated documentation:
[docs/TEMPLATE_SYNTAX.md](../../docs/TEMPLATE_SYNTAX.md)
