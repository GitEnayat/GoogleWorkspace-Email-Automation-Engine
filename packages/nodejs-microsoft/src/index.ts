export * from './providers/NodeMicrosoftEmailProvider';
export * from './providers/NodeMicrosoftOneDriveTemplateLoader';
export * from './providers/NodeMicrosoftExcelDataStore';
export * from './providers/NodeMicrosoftExcelTableRenderer';
export * from './utils/WordToHtmlConverter';

import { EmailEngine } from '@universal-email/core';
import { Client } from '@microsoft/microsoft-graph-client';
import { NodeMicrosoftEmailProvider } from './providers/NodeMicrosoftEmailProvider';
import { NodeMicrosoftOneDriveTemplateLoader } from './providers/NodeMicrosoftOneDriveTemplateLoader';
import { NodeMicrosoftExcelDataStore } from './providers/NodeMicrosoftExcelDataStore';
import { NodeMicrosoftExcelTableRenderer } from './providers/NodeMicrosoftExcelTableRenderer';

export interface NodeMicrosoftServicesConfig {
  graphClient: Client;
  userEmail?: string;
  logger?: any;
}

export function createNodeMicrosoftEmailEngine(config: NodeMicrosoftServicesConfig): EmailEngine {
  const emailProvider = new NodeMicrosoftEmailProvider(config.graphClient, config.userEmail);
  const dataStore = new NodeMicrosoftExcelDataStore(config.graphClient);
  const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(config.graphClient);
  const tableRenderer = new NodeMicrosoftExcelTableRenderer(config.graphClient);

  return new EmailEngine({
    email: emailProvider,
    data: dataStore,
    template: templateLoader,
    tables: tableRenderer,
    logger: config.logger || console
  });
}
