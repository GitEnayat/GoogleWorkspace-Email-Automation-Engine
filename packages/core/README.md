# Universal Email Automation Engine - Core Package

The `@universal-email/core` package provides the essential, platform-agnostic business logic for the Universal Email Automation Engine. It defines the core interfaces and classes necessary for email generation, templating, and validation, allowing developers to integrate with any platform (e.g., Google Workspace, Microsoft 365, custom APIs) by implementing these interfaces.

## Installation

To integrate the core engine into your project:

```bash
npm install @universal-email/core
```

## Exports

This package exports the following key classes, interfaces, and types for building platform adapters and custom solutions:

*   `EmailEngine`: The main orchestration class.
*   `TemplateValidator`: Utility for pre-flight template validation.
*   `PlatformServices`: The top-level interface defining all required and optional platform services.
*   **Types**:
    *   `EmailConfig`
    *   `EmailDraft`
    *   `ExecutionResult`
    *   `LocaleConfig`
    *   `LogEntry`
    *   `ManagedLink`
    *   `ParsedTemplate`
    *   `Recipient`
    *   `TableRange`
    *   `UserProfile`
    *   `ValidationResult`

## PlatformServices Interface

The `EmailEngine` is initialized with an object conforming to the `PlatformServices` interface. This enables dependency injection of platform-specific implementations for various functionalities.

```typescript
export interface PlatformServices {
  email: EmailProvider;
  template: TemplateLoader;
  data: DataStore;
  logger: Logger;
  links?: LinkRepository;
  tables?: TableRenderer;
  cache?: Cache;
}
```

## Core Interfaces for Platform Adapters

To build a new platform adapter, you must implement the following interfaces:

### `EmailProvider`

Abstracts email service operations (draft creation, sending).

```typescript
export interface EmailProvider {
  createDraft(subject: string, body: string, to: string[], cc?: string[], bcc?: string[], htmlBody?: string): Promise<string>;
  updateDraft(draftId: string, subject: string, body: string, htmlBody?: string): Promise<void>;
  findDraftBySubject(subject: string): Promise<string | null>;
  findThreadBySubject?(subject: string): Promise<string | null>; // Optional
  createReplyDraft?(threadId: string, body: string, cc?: string[], bcc?: string[], htmlBody?: string): Promise<string>; // Optional
  sendEmail(draftId?: string, to?: string[], subject?: string, body?: string): Promise<void>;
  getCurrentUserEmail(): string;
}
```

### `TemplateLoader`

Abstracts loading and parsing templates from various sources.

```typescript
export interface TemplateLoader {
  loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate>;
  getRawContent(templateName: string, sourceId: string): Promise<string>;
}
```

### `DataStore`

Abstracts operations for accessing structured data (e.g., spreadsheets, databases).

```typescript
export interface DataStore {
  getData(sheetId: string, range: string): Promise<any[][]>;
  getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]>;
  appendRow(sheetId: string, tabName: string, row: any[]): Promise<void>;
}
```

### `LinkRepository` (Optional)

Manages URL mappings for dynamic link injection.

```typescript
export interface LinkRepository {
  loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]>;
  getLink(key: string): Promise<ManagedLink | null>;
}
```

### `TableRenderer` (Optional)

Abstracts the process of rendering data tables into HTML.

```typescript
export interface TableRenderer {
  renderTable(sheetId: string, range: string): Promise<string>;
}
```

### `Logger`

Abstracts logging operations.

```typescript
export interface Logger {
  info(component: string, message: string, context?: Record<string, any>): void;
  warn(component: string, message: string, context?: Record<string, any>): void;
  error(component: string, message: string, context?: Record<string, any>): void;
  debug(component: string, message: string, context?: Record<string, any>): void;
}
```

### `Cache` (Optional)

Abstracts caching operations.

```typescript
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

## Minimal Adapter Skeleton

Here's a minimal example of how you might structure a `PlatformServices` implementation for a new platform:

```typescript
import {
  PlatformServices,
  EmailProvider,
  TemplateLoader,
  DataStore,
  Logger,
  // ... other interfaces
} from '@universal-email/core';

// Implement your platform's specific EmailProvider
class MyPlatformEmailProvider implements EmailProvider {
  // ... implement methods
}

// Implement your platform's specific TemplateLoader
class MyPlatformTemplateLoader implements TemplateLoader {
  // ... implement methods
}

// Implement your platform's specific DataStore
class MyPlatformDataStore implements DataStore {
  // ... implement methods
}

// Implement a basic logger
const myLogger: Logger = {
  info: (c, m, ctx) => console.log(`[INFO][${c}] ${m}`, ctx),
  warn: (c, m, ctx) => console.warn(`[WARN][${c}] ${m}`, ctx),
  error: (c, m, ctx) => console.error(`[ERROR][${c}] ${m}`, ctx),
  debug: (c, m, ctx) => console.debug(`[DEBUG][${c}] ${m}`, ctx),
};

// Assemble your platform services
export const myPlatformServices: PlatformServices = {
  email: new MyPlatformEmailProvider(),
  template: new MyPlatformTemplateLoader(),
  data: new MyPlatformDataStore(),
  logger: myLogger,
  // links: new MyPlatformLinkRepository(), // Optional
  // tables: new MyPlatformTableRenderer(), // Optional
  // cache: new MyPlatformCache(), // Optional
};
```

## Template Syntax

