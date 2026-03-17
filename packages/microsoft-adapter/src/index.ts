export * from './providers/MicrosoftOutlookEmailProvider';
export * from './providers/MicrosoftExcelDataStore';
export * from './providers/MicrosoftWordTemplateLoader';
export * from './providers/MicrosoftExcelTableRenderer';
export * from './providers/MicrosoftLogger';

import { EmailEngine } from '@universal-email/core';
import { MicrosoftOutlookEmailProvider } from './providers/MicrosoftOutlookEmailProvider';
import { MicrosoftExcelDataStore } from './providers/MicrosoftExcelDataStore';
import { MicrosoftWordTemplateLoader } from './providers/MicrosoftWordTemplateLoader';
import { MicrosoftExcelTableRenderer } from './providers/MicrosoftExcelTableRenderer';
import { MicrosoftLogger } from './providers/MicrosoftLogger';
import { Client } from '@microsoft/microsoft-graph-client';

export interface MicrosoftServicesConfig {
  graphClient: Client;
  userEmail: string;
  excelFilePath: string;
  wordTemplatesDir?: string;
}

export function createMicrosoftEmailEngine(config: MicrosoftServicesConfig): EmailEngine {
  const emailProvider = new MicrosoftOutlookEmailProvider(config.graphClient, config.userEmail);
  const dataStore = new MicrosoftExcelDataStore(config.excelFilePath);
  const templateLoader = new MicrosoftWordTemplateLoader(config.wordTemplatesDir);
  const tableRenderer = new MicrosoftExcelTableRenderer(config.excelFilePath);
  const logger = new MicrosoftLogger();

  return new EmailEngine({
    email: emailProvider,
    data: dataStore,
    template: templateLoader,
    tables: tableRenderer,
    logger
  });
}
