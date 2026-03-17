import { EmailEngine, EmailConfig } from '@universal-email/core';
import { 
  GoogleAppsEmailProvider, 
  GoogleDocsTemplateLoader, 
  GoogleSheetsDataStore, 
  GoogleAppsLinkRepository, 
  GoogleAppsLogger, 
  GoogleSheetsTableRenderer 
} from './providers';

export * from './providers';

/**
 * MAIN ENTRY POINT FOR APPS SCRIPT LIBRARY
 * 
 * This is the function users will call from their own scripts.
 * Example: EmailEngine.run('Morning_Report', { templateDocumentId: '...' });
 */
export function run(templateName: string, config: Partial<EmailConfig>) {
  const emailProvider = new GoogleAppsEmailProvider();
  const templateLoader = new GoogleDocsTemplateLoader();
  const dataStore = new GoogleSheetsDataStore();
  const linkRepository = new GoogleAppsLinkRepository();
  const logger = new GoogleAppsLogger();
  const tableRenderer = new GoogleSheetsTableRenderer();

  const engine = new EmailEngine({
    email: emailProvider,
    template: templateLoader,
    data: dataStore,
    links: linkRepository,
    logger: logger,
    tables: tableRenderer
  });

  return engine.generateEmailDraft(templateName, config);
}

/**
 * Convenience wrapper for batch runs
 */
export function runBatch(templateNames: string[], config: Partial<EmailConfig>) {
  const emailProvider = new GoogleAppsEmailProvider();
  const templateLoader = new GoogleDocsTemplateLoader();
  const dataStore = new GoogleSheetsDataStore();
  const linkRepository = new GoogleAppsLinkRepository();
  const logger = new GoogleAppsLogger();
  const tableRenderer = new GoogleSheetsTableRenderer();

  const engine = new EmailEngine({
    email: emailProvider,
    template: templateLoader,
    data: dataStore,
    links: linkRepository,
    logger: logger,
    tables: tableRenderer
  });

  return engine.generateBatchDrafts(templateNames, config);
}
