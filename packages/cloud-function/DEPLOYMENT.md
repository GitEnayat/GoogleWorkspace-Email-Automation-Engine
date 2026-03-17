# ☁️ Deployment Guide: Google Cloud Function

This guide explains how to deploy the **Universal Email Automation Engine** as a serverless microservice on Google Cloud Platform (GCP).

## 1. Prerequisites
1.  **GCP Account**: A Google Cloud account with billing enabled (Free tier applies).
2.  **gcloud CLI**: Installed and authenticated (`gcloud auth login`).
3.  **Service Account**: 
    *   Create a Service Account in GCP Console.
    *   Grant it the role: `Cloud Functions Developer`.
    *   Grant it "Domain-Wide Delegation" if you want it to send emails as you.

## 2. One-Click Deployment
From the root of the project, run:
```bash
cd packages/cloud-function
npm install
npm run build
npm run deploy
```

## 3. How to Trigger from Google Sheets
Use this Apps Script code inside any Google Sheet to ping your new Cloud Function:

```javascript
function triggerCloudEngine() {
  const CLOUD_URL = "https://YOUR_GCP_REGION-YOUR_PROJECT_ID.cloudfunctions.net/email-engine";
  
  const payload = {
    templateName: "Morning_Status",
    config: {
      templateDocumentId: "YOUR_DOC_ID",
      directorySheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      emailAction: "DRAFT"
    }
  };

  const response = UrlFetchApp.fetch(CLOUD_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  Logger.log(response.getContentText());
}
```

## 4. Why this is superior
*   **No Timeouts**: Runs past the 6-minute Apps Script limit.
*   **Secure**: Uses IAM roles and Service Accounts.
*   **Scalable**: Google automatically scales the server up if you send 10,000 emails.
