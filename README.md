# Universal Email Automation Engine v2.0

> **The Evolution of Operational Efficiency** — From a single Google Apps Script to a Universal TypeScript Orchestration Platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)
[![Platform: Google Workspace](https://img.shields.io/badge/Platform-Google%20Workspace-4285F4)](https://workspace.google.com/)

---

## 📖 The Story: From WFM Pain to Scalable Engineering

### 2023: The "Copy-Paste" Nightmare
This project started in the trenches of **Workforce Management (WFM)**. My daily routine involved hours of manual labor:
*   Exporting data from various systems into Google Sheets.
*   Formatting complex tables manually in Gmail.
*   Copy-pasting email addresses and ensuring the right people got the right report.
*   **The Problem:** It was slow, error-prone, and required me to be there every single day.

### 2024: The First Script (v1.0)
I wrote my first Google Apps Script to automate a single report. It worked, but as the team grew, I hit a wall:
*   **The "N+1" Problem:** Every new report needed a new script.
*   **Hardcoding:** Email lists were buried in code. If someone left the team, only I could fix it.
*   **Rendering:** Generating HTML tables in Apps Script was messy and hard to maintain.

### 2025: The "No-Code" Bridge
I realized that for this to be truly useful, **non-coders needed to control it**. 
*   I moved templates into **Google Docs** (so anyone could edit the design).
*   I created a **Dictionary** in Google Sheets (so anyone could update email lists and "Tokens").
*   I turned the engine into an **Apps Script Library** used across 30+ different reports.

### 2026: The Universal Engine (v2.0)
Recognizing the limitations of the Apps Script environment, I've completely rebuilt the engine in **Node.js and TypeScript**. 
*   **Why?** To provide professional-grade type safety, modular architecture (Provider Pattern), and the ability to run anywhere—from the CLI to a cloud server—while maintaining its roots in Google Workspace.

---

## 🎯 Core Philosophy
1.  **Non-Coder Friendly:** Templates are managed in Google Docs, and data is managed in Sheets. No one needs to touch code to change an email's "look and feel."
2.  **Platform Agnostic:** The `Core` engine doesn't care if you're using Gmail, SendGrid, or AWS SES. Just swap the provider.
3.  **WFM Optimized:** Built specifically to handle complex data tables, dynamic greetings (Good Morning/Afternoon), and date-based tokens (e.g., `{{DATE:Today}}`).

---

## 🏗️ Architecture

The project is structured as a **TypeScript Monorepo**:

*   **`@universal-email/core`**: The logic "brain." Handles template parsing, token replacement, and orchestration.
*   **`@universal-email/apps-script-adapter`**: A specialized bridge that bundles the engine into a single `.gs` file for Google Workspace.
*   **`@universal-email/cli`**: A terminal tool for developers to test, validate, and "deploy" templates.

---

## 🚀 Quick Start

### For Google Apps Script
1.  Navigate to `packages/apps-script-adapter`.
2.  Run `npm run build`.
3.  Copy `dist/EmailEngine.gs` to your Apps Script project.
4.  Call the engine:
    ```javascript
    EmailEngine.generateEmailDraft('Morning_Report', {
      templateDocumentId: 'your-doc-id',
      directorySheetId: 'your-sheet-id'
    });
    ```

### For Node.js Developers
```bash
npm install @universal-email/core
```

---

## 🎨 Feature Highlight: The Token System
*   `{{FirstName}}`: Basic replacement from Sheet data.
*   `{{GREETING}}`: Context-aware (Morning/Afternoon/Evening).
*   `{{DATE:Next Monday}}`: Sophisticated date parsing for report headers.
*   `$LINK:Sheet_ID, TEXT:Open Report$`: Managed, clickable link generation.

---

## 🤝 Contributing
I built this to solve a real-world problem in operations. If you've ever felt the pain of manual reporting, I'd love your help expanding this into:
- [ ] SendGrid/SES Providers
- [ ] MJML Template Support
- [ ] AI-powered "Tone Checker" for emails

---

## 📄 License
MIT License. Created with ❤️ by **Enayatullh**.
