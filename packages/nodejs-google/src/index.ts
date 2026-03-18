export * from './providers/NodeGoogleEmailProvider';
export * from './providers/NodeGoogleSheetsDataStore';
export * from './providers/NodeGoogleDocsTemplateLoader';
export * from './providers/NodeGoogleSheetsTableRenderer';
export * from './utils/DocsToHtmlConverter';

import { EmailEngine } from '@universal-email/core';
import { NodeGoogleEmailProvider } from './providers/NodeGoogleEmailProvider';
import { NodeGoogleSheetsDataStore } from './providers/NodeGoogleSheetsDataStore';
import { NodeGoogleDocsTemplateLoader } from './providers/NodeGoogleDocsTemplateLoader';
import { NodeGoogleSheetsTableRenderer } from './providers/NodeGoogleSheetsTableRenderer';

export interface NodeGoogleServicesConfig {
  auth: any; // OAuth2Client or JWT
  userEmail?: string;
  logger?: any;
}

export function createNodeGoogleEmailEngine(config: NodeGoogleServicesConfig): EmailEngine {
  const emailProvider = new NodeGoogleEmailProvider(config.auth, config.userEmail);
  const dataStore = new NodeGoogleSheetsDataStore(config.auth);
  const templateLoader = new NodeGoogleDocsTemplateLoader(config.auth);
  const tableRenderer = new NodeGoogleSheetsTableRenderer(config.auth);

  return new EmailEngine({
    email: emailProvider,
    data: dataStore,
    template: templateLoader,
    tables: tableRenderer,
    logger: config.logger || console
  });
}
