/**
 * @universal-email/apps-script-adapter
 * 
 * Google Apps Script adapter for Universal Email Automation Engine
 * 
 * Usage in Apps Script:
 * ```javascript
 * function generateEmailDraft(templateName, config) {
 *   return EmailEngine.generateEmailDraft(templateName, config);
 * }
 * ```
 */

import { EmailEngine, EmailConfig, PlatformServices } from '@universal-email/core';
import { GoogleAppsEmailProvider } from './GoogleAppsEmailProvider';
import { GoogleDocsTemplateLoader } from './GoogleDocsTemplateLoader';
import { GoogleSheetsDataStore } from './GoogleSheetsDataStore';
import { GoogleAppsLinkRepository } from './GoogleAppsLinkRepository';
import { GoogleAppsLogger } from './GoogleAppsLogger';

/**
 * Create a configured Email Engine instance for Google Apps Script
 */
export function createEmailEngine(config?: Partial<EmailConfig>): EmailEngine {
  const emailProvider = new GoogleAppsEmailProvider();
  const templateLoader = new GoogleDocsTemplateLoader();
  const dataStore = new GoogleSheetsDataStore();
  const linkRepository = new GoogleAppsLinkRepository();
  const logger = new GoogleAppsLogger(
    config?.directorySheetId, // Use directory sheet for logs too
    config?.logsTabName || 'System_Logs'
  );

  const services: PlatformServices = {
    email: emailProvider,
    template: templateLoader,
    data: dataStore,
    links: linkRepository,
    logger
  };

  return new EmailEngine(services, config);
}

/**
 * Global function exposed to Apps Script
 * This is the main entry point when bundled
 */
function generateEmailDraft(templateName: string, userOverrides: any = {}): any {
  const engine = createEmailEngine(userOverrides);
  return engine.generateEmailDraft(templateName, userOverrides);
}

/**
 * Batch draft generation function exposed to Apps Script
 */
async function generateBatchDrafts(templateNames: string[], userOverrides: any = {}): Promise<any[]> {
  const engine = createEmailEngine(userOverrides);
  return await engine.generateBatchDrafts(templateNames, userOverrides);
}

/**
 * Test mode helper
 */
function testEmailDraft(templateName: string): any {
  return generateEmailDraft(templateName, {
    testMode: true,
    dryRun: true
  });
}

// Export for bundling
export {
  generateEmailDraft,
  generateBatchDrafts,
  testEmailDraft,
  GoogleAppsEmailProvider,
  GoogleDocsTemplateLoader,
  GoogleSheetsDataStore,
  GoogleAppsLinkRepository,
  GoogleAppsLogger
};
