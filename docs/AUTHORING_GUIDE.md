# 📘 Email Engine: Template Authoring Guide

This guide explains how to create beautifully automated emails using the Universal Email Engine. You only need two things: a **Google Doc** (for your template) and a **Google Sheet** (for your data).

---

## 1. Creating Your Template (Google Doc)

Open a Google Doc and design your email exactly how you want it to look. You can use **Bold**, *Italic*, Colors, and standard Google Doc Tables.

### 🏷️ Using Tags (The Dictionary)
Place "Tags" inside double curly brackets `{{ }}`. The engine will automatically replace these with real data.

| Tag Category | Example | Result |
| :--- | :--- | :--- |
| **Recipients** | `Hello {{FirstName}},` | `Hello John,` |
| **Greetings** | `{{GREETING}}, team!` | `Good Morning, team!` (based on time) |
| **Date/Time** | `Date: {{DATE:Today}}` | `Date: 17-Mar-2026` |

---

## 2. Robust Date & Time Tokens
The engine supports advanced date logic, which is essential for **Workforce Management (WFM)** and scheduling.

| Token | Description | Output Example |
| :--- | :--- | :--- |
| `{{DATE:Today}}` | Current date | `17-Mar-2026` |
| `{{DATE:Yesterday}}` | Day before today | `16-Mar-2026` |
| `{{DATE:Tomorrow}}` | Day after today | `18-Mar-2026` |
| `{{DATE:Next Monday}}` | The coming Monday | `23-Mar-2026` |
| `{{DATE:Last Friday}}` | The previous Friday | `13-Mar-2026` |

---

## 3. Dynamic Tables from Sheets
To insert a data table from a spreadsheet, simply type this line on a new paragraph in your Google Doc:

**Format:** `[Table] YOUR_SHEET_URL, 'Tab Name'!A1:E10`

*   **Pro Tip**: You can just paste the full URL of the spreadsheet from your browser bar.
*   **Style**: The engine will preserve your Sheet's **Background Colors**, **Bold Text**, and **Column Widths**.

---

## 4. Content Management (Managed Links)
Instead of typing long URLs into your template, use the **Link Repository**. This allows you to update one link in a Sheet, and it will update every email that uses it.

**Format:** `$LINK:KeyName, TEXT:Display Label$`

*   **Example**: `Please check the $LINK:Tracker, TEXT:Project Tracker$`
*   **Result**: `Please check the <a href="...">Project Tracker</a>`

**How to set up the Repository Sheet:**
Create a tab named `Link_Registry` with these columns:
1.  **Link_Key**: (e.g., `Tracker`)
2.  **Target_URL**: (e.g., `https://...`)
3.  **Label**: (Optional description)

---

## 5. Recipient List (Headcount)
The engine looks at your "Directory Sheet" to decide who gets an email.

**How to set up your Recipient Sheet:**
Create a tab (e.g., `Recipients`) with these columns:
1.  **Email**: The person's email address.
2.  **FirstName**: (Optional) For the `{{FirstName}}` tag.
3.  **Any other column**: Any column you add here (e.g., `Department`, `ShiftTime`) can be used as a tag in your Doc!

---

## 🚀 Summary Checklist for Users
1.  **Write Template**: Create a Google Doc with `{{Tags}}`.
2.  **Add Recipients**: List your users in a Google Sheet.
3.  **Configure Links**: (Optional) Add your links to the `Link_Registry`.
4.  **Trigger**: Run the `EmailEngine.run()` script from your Sheet.
