import * as ff from '@google-cloud/functions-framework';
import { createNodeGoogleEmailEngine } from '@universal-email/node-google-adapter';
import { GoogleAuth } from 'google-auth-library';

/**
 * HTTP Cloud Function Entry Point
 * 
 * Payload Example:
 * {
 *   "templateName": "Morning_Status",
 *   "config": {
 *     "templateDocumentId": "...",
 *     "directorySheetId": "...",
 *     "emailAction": "DRAFT"
 *   }
 * }
 */
ff.http('emailEngineHandler', async (req: ff.Request, res: ff.Response) => {
  // 1. Setup CORS (Allow pinging from Google Sheets)
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  try {
    const { templateName, config } = req.body;

    if (!templateName || !config) {
      res.status(400).send({ error: 'Missing templateName or config in request body' });
      return;
    }

    // 2. Initialize Auth (Automatic using GCP Service Account)
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/documents.readonly'
      ],
    });
    const client = await auth.getClient();

    // 3. Create the Engine using the Node-Google Adapter
    const engine = createNodeGoogleEmailEngine({ 
      auth: client,
      logger: console // Logs will show up in GCP Cloud Logging
    });

    // 4. Run the Engine
    console.log(`Executing engine for template: ${templateName}`);
    const result = await engine.generateEmailDraft(templateName, config);

    // 5. Return the result
    if (result.success) {
      res.status(200).send({
        message: 'Engine executed successfully',
        draftId: result.draftId,
        recipientCount: result.recipientCount,
        duration: result.duration
      });
    } else {
      res.status(500).send({
        error: 'Engine execution failed',
        details: result.error
      });
    }

  } catch (error: any) {
    console.error('Cloud Function Error:', error);
    res.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
});
