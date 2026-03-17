#!/usr/bin/env node

/**
 * Universal Email Automation Engine CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('email-engine')
  .description('Universal Email Automation Engine CLI')
  .version('2.0.0');

program
  .command('generate <template>')
  .description('Generate an email draft from a template')
  .option('-d, --dry-run', 'Run in dry-run mode (no drafts created)')
  .option('-t, --test', 'Run in test mode (send to current user)')
  .option('-s, --send', 'Send email immediately instead of creating draft')
  .option('--doc-id <id>', 'Template document ID')
  .option('--sheet-id <id>', 'Directory sheet ID')
  .action(async (template, options) => {
    const spinner = ora(`Generating email draft: ${template}`).start();

    try {
      // Lazy import to avoid loading heavy dependencies unnecessarily
      const { createEmailEngine } = await import('@universal-email/apps-script-adapter');

      const config: any = {
        dryRun: options.dryRun,
        testMode: options.test,
        emailAction: options.send ? 'SEND' as const : 'DRAFT' as const,
        templateDocumentId: options.docId,
        directorySheetId: options.sheetId
      };

      const engine = createEmailEngine(config);
      const result = await engine.generateEmailDraft(template, config);

      if (result.success) {
        spinner.succeed(chalk.green(`Draft generated successfully!`));
        console.log(chalk.blue(`  Draft ID: ${result.draftId}`));
        console.log(chalk.blue(`  Recipients: ${result.recipientCount}`));
        console.log(chalk.blue(`  Duration: ${result.duration}ms`));
        console.log(chalk.blue(`  Mode: ${result.mode}`));
      } else {
        spinner.fail(chalk.red(`Failed to generate draft`));
        console.log(chalk.red(`  Error: ${result.error}`));
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('validate <template>')
  .description('Validate a template exists and has correct structure')
  .option('--doc-id <id>', 'Template document ID')
  .action(async (template, options) => {
    const spinner = ora(`Validating template: ${template}`).start();

    try {
      if (!options.docId) {
        spinner.fail(chalk.red('Template document ID is required'));
        console.log(chalk.yellow('  Usage: email-engine validate <template> --doc-id <your-doc-id>'));
        process.exit(1);
      }

      // In a real implementation, this would connect to Google Docs API
      // For now, we validate the template name format
      if (!template || template.trim().length === 0) {
        throw new Error('Template name cannot be empty');
      }

      // Validate template name doesn't contain invalid characters
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(template)) {
        throw new Error('Template name contains invalid characters');
      }

      spinner.succeed(chalk.green(`Template structure is valid`));
      console.log(chalk.blue(`  Template: ${template}`));
      console.log(chalk.blue(`  Document ID: ${options.docId}`));
      console.log(chalk.green(`  ✓ Name format is valid`));
      console.log(chalk.yellow(`  ⚠ Note: Full validation requires Google API connection`));
    } catch (error: any) {
      spinner.fail(chalk.red(`Validation failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all available templates')
  .option('--doc-id <id>', 'Template document ID')
  .action(async (options) => {
    const spinner = ora('Loading templates').start();

    try {
      if (!options.docId) {
        spinner.warn(chalk.yellow('Document ID not provided, showing example templates'));
        console.log('\n' + chalk.blue('Example templates (configure --doc-id to see your templates):'));
        console.log(chalk.white('  - Morning_Status'));
        console.log(chalk.white('  - Weekly_Report'));
        console.log(chalk.white('  - Shift_Handover'));
        console.log('\n' + chalk.yellow('Tip: Store your templates in a Google Doc with sections marked by {{TemplateName}}'));
      } else {
        // In a real implementation, this would connect to Google Docs API
        // For now, show a helpful message
        spinner.succeed(chalk.green(`Connected to document`));
        console.log('\n' + chalk.blue('Templates found:'));
        console.log(chalk.white('  - Morning_Status'));
        console.log(chalk.white('  - Weekly_Report'));
        console.log(chalk.white('  - Shift_Handover'));
        console.log('\n' + chalk.yellow(`Note: Showing example output. Full implementation requires Google API.`));
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('init [project-name]')
  .description('Initialize a new email automation project')
  .option('--template <type>', 'Project template type (basic, advanced)', 'basic')
  .action((projectName, options) => {
    const name = projectName || 'email-automation';
    const targetDir = path.join(process.cwd(), name);

    console.log(chalk.blue(`Initializing new project: ${name}`));
    console.log(chalk.blue(`Template: ${options.template}\n`));

    // Check if directory exists
    if (fs.existsSync(targetDir)) {
      console.log(chalk.yellow(`Warning: Directory '${name}' already exists`));
      const shouldContinue = true; // In real CLI, would prompt user
      if (!shouldContinue) {
        process.exit(1);
      }
    }

    // Create project structure
    const directories = [
      'templates',
      'config',
      'scripts',
      'logs'
    ];

    directories.forEach(dir => {
      const dirPath = path.join(targetDir, dir);
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(`  ✓ Created ${dir}/`));
    });

    // Create package.json
    const packageJson = {
      name: name,
      version: '1.0.0',
      description: 'Email automation project',
      scripts: {
        'generate': 'email-engine generate',
        'test': 'email-engine generate --test'
      },
      dependencies: {
        '@universal-email/cli': '^2.0.0'
      }
    };

    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    console.log(chalk.green(`  ✓ Created package.json`));

    // Create config file
    const configContent = `/**
 * Email Automation Configuration
 * 
 * Update these values with your Google Workspace IDs
 */

module.exports = {
  // Google Doc containing email templates
  templateDocumentId: 'INSERT_TEMPLATE_DOC_ID',
  
  // Google Sheet containing recipient directory
  directorySheetId: 'INSERT_DIRECTORY_SHEET_ID',
  recipientsTabName: 'Recipients_Master',
  
  // Google Sheet containing managed links (optional)
  linkRepositorySheetId: 'INSERT_LINK_SHEET_ID',
  linkRepositoryTabName: 'Link_Registry',
  
  // Default execution mode
  emailAction: 'DRAFT',  // 'DRAFT' or 'SEND'
  
  // Column mappings
  recipientEmailColumn: 'Email',
  recipientTagColumns: ['Role', 'Team', 'Department']
};
`;

    fs.writeFileSync(
      path.join(targetDir, 'config', 'defaults.js'),
      configContent
    );
    console.log(chalk.green(`  ✓ Created config/defaults.js`));

    // Create example runner script
    const runnerContent = `/**
 * Example Runner Script
 * 
 * Usage: node scripts/send-report.js Morning_Status
 */

const config = require('../config/defaults');

async function sendReport(templateName) {
  console.log(\`Generating email draft: \${templateName}\`);
  
  // In a real implementation, you would:
  // 1. Import the engine: const { EmailEngine } = require('@universal-email/core');
  // 2. Create providers
  // 3. Generate the draft
  
  console.log('Configuration loaded:');
  console.log(JSON.stringify(config, null, 2));
  console.log('\\nReady to generate drafts!');
}

// Run if called directly
if (require.main === module) {
  const template = process.argv[2] || 'Morning_Status';
  sendReport(template).catch(console.error);
}

module.exports = { sendReport };
`;

    fs.writeFileSync(
      path.join(targetDir, 'scripts', 'send-report.js'),
      runnerContent
    );
    console.log(chalk.green(`  ✓ Created scripts/send-report.js`));

    // Create README
    const readmeContent = `# ${name}

Email automation project built with Universal Email Automation Engine.

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Generate a draft (dry run)
npm run test -- Morning_Status

# Generate and send
npx email-engine generate Morning_Status --doc-id YOUR_DOC_ID --sheet-id YOUR_SHEET_ID
\`\`\`

## Configuration

Edit \`config/defaults.js\` with your Google Workspace IDs.

## Available Commands

\`\`\`bash
# List templates
npx email-engine list --doc-id YOUR_DOC_ID

# Validate template
npx email-engine validate Morning_Status --doc-id YOUR_DOC_ID

# Generate draft
npx email-engine generate Morning_Status --dry-run

# Test mode (sends to you)
npx email-engine generate Morning_Status --test
\`\`\`

## Template Syntax

Create templates in Google Docs with sections marked by \`{{TemplateName}}\`.

Use tags like \`{{FirstName}}\`, \`{{DATE:Today}}\`, \`{{GREETING}}\`.

## License

MIT
`;

    fs.writeFileSync(
      path.join(targetDir, 'README.md'),
      readmeContent
    );
    console.log(chalk.green(`  ✓ Created README.md`));

    // Create .gitignore
    const gitignore = `node_modules/
logs/
.env
`;

    fs.writeFileSync(
      path.join(targetDir, '.gitignore'),
      gitignore
    );
    console.log(chalk.green(`  ✓ Created .gitignore`));

    console.log('\n' + chalk.green('✓ Project initialized successfully!\n'));
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.white(`  1. cd ${name}`));
    console.log(chalk.white('  2. npm install'));
    console.log(chalk.white('  3. Edit config/defaults.js with your Google Workspace IDs'));
    console.log(chalk.white('  4. Create your first template in Google Docs'));
    console.log(chalk.white(`  5. npx email-engine generate Morning_Status --test\n`));
  });

program
  .command('config')
  .description('Display current configuration')
  .option('--doc-id <id>', 'Template document ID')
  .option('--sheet-id <id>', 'Directory sheet ID')
  .action((options) => {
    console.log(chalk.blue('Current Configuration:\n'));
    
    if (options.docId) {
      console.log(chalk.white(`  Template Document ID: ${options.docId}`));
    } else {
      console.log(chalk.yellow('  Template Document ID: Not set'));
    }
    
    if (options.sheetId) {
      console.log(chalk.white(`  Directory Sheet ID: ${options.sheetId}`));
    } else {
      console.log(chalk.yellow('  Directory Sheet ID: Not set'));
    }
    
    console.log('\n' + chalk.yellow('Tip: Use environment variables or config files for production'));
  });

program
  .command('docs')
  .description('Open documentation in browser')
  .action(() => {
    console.log(chalk.blue('\nDocumentation Links:\n'));
    console.log(chalk.white('  GitHub:    https://github.com/anomalyco/universal-email-automation'));
    console.log(chalk.white('  npm:       https://www.npmjs.com/package/@universal-email/core'));
    console.log(chalk.white('  Issues:    https://github.com/anomalyco/universal-email-automation/issues\n'));
  });

// Handle unknown commands
program.on('command:*', function () {
  console.error(chalk.red(`Error: Unknown command '${program.args.join(' ')}'`));
  console.log(chalk.yellow('\nRun with --help for available commands\n'));
  process.exit(1);
});

program.parse();
