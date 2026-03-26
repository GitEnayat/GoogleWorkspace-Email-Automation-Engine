# Template Syntax Reference

This document provides a comprehensive reference for authoring email templates. The syntax described here is platform-neutral and functions identically whether using Google Docs or Word Online as template sources.

## Template Structure

Email templates are typically structured using special tags within the document to define the subject, body, and recipients.

-   `[SUBJECT]`...`[/SUBJECT]`: Defines the email subject line.
-   `[TO]`...`[/TO]`: Defines primary recipients. Multiple addresses can be comma-separated.
-   `[CC]`...`[/CC]`: Defines carbon copy recipients. Multiple addresses can be comma-separated.
-   `[BODY]`...`[/BODY]`: Defines the main content of the email. If no `[BODY]` tag is present, the entire document content outside of `[SUBJECT]`, `[TO]`, and `[CC]` is considered the body.

**Example:**

```
[SUBJECT]Your Personalized Update - {{DATE:Today}}[/SUBJECT]
[TO]{{RecipientEmail}}[/TO]
[CC]info@example.com[/CC]

Dear {{FirstName}},

This is a personalized email for you.
{{GREETING}}

Here is some information:
[Table] https://docs.google.com/spreadsheets/d/SHEET_ID/edit, 'Data'!A1:C5 [/Table]

Please review the details. More information can be found at $LINK:SupportPage, TEXT:Our Support Site$.

Sincerely,
The Team
```

## Template Tokens

Tokens are special placeholders that are replaced with dynamic content during email generation.

### Recipient Tags

These tokens correspond to column headers in your recipient spreadsheet.

| Token             | Description                                   | Example Output    |
| :---------------- | :-------------------------------------------- | :---------------- |
| `{{ColumnName}}`  | Value from the `ColumnName` column for the current recipient. | `John`            |
| `{{FirstName}}`   | Example for a `FirstName` column.             | `Jane`            |
| `{{RecipientEmail}}` | Example for an `RecipientEmail` column.      | `john@example.com` |

### Time-Based Greetings

| Token        | Description                                               | Example Output    |
| :----------- | :-------------------------------------------------------- | :---------------- |
AbortError: The user aborted a request.
    at abort (/usr/local/lib/node_modules/@google/gemini-cli/node_modules/node-fetch/lib/index.js:1458:16)
    at AbortSignal.abortAndFinalize (/usr/local/lib/node_modules/@google/gemini-cli/node_modules/node-fetch/lib/index.js:1473:4)
    at [nodejs.internal.kHybridDispatch] (node:internal/event_target:827:20)
    at AbortSignal.dispatchEvent (node:internal/event_target:762:26)
    at runAbort (node:internal/abort_controller:486:10)
    at abortSignal (node:internal/abort_controller:463:5)
    at AbortController.abort (node:internal/abort_controller:505:5)
    at GeminiClient._recoverFromLoop (file:///usr/local/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/client.js:796:28)
    at GeminiClient.processTurn (file:///usr/local/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/client.js:517:32)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
