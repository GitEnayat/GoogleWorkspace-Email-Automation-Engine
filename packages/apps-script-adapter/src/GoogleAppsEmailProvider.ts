/**
 * Google Apps Script Email Provider
 * Implements EmailProvider using GmailApp
 */

import { EmailProvider } from '@universal-email/core';

export class GoogleAppsEmailProvider implements EmailProvider {
  createDraft(
    subject: string,
    body: string,
    to: string[],
    cc?: string[],
    bcc?: string[]
  ): Promise<string> {
    const draft = GmailApp.createDraft(
      to.join(','),
      subject,
      body,
      {
        cc: cc?.join(','),
        bcc: bcc?.join(',')
      }
    );
    return Promise.resolve(draft.getId());
  }

  updateDraft(draftId: string, subject: string, body: string): Promise<void> {
    const draft = GmailApp.getDraft(draftId);
    draft.update(draft.getMessage().getTo(), subject, body);
    return Promise.resolve();
  }

  findDraftBySubject(subject: string): Promise<string | null> {
    const threads = GmailApp.search(`in:drafts subject:"${subject}"`);
    if (threads.length > 0) {
      const messages = threads[0].getMessages();
      if (messages.length > 0) {
        const draft = GmailApp.getDraft(messages[0].getId());
        return Promise.resolve(draft.getId());
      }
    }
    return Promise.resolve(null);
  }

  sendEmail(
    draftId?: string,
    to?: string[],
    subject?: string,
    body?: string
  ): Promise<void> {
    if (draftId) {
      const draft = GmailApp.getDraft(draftId);
      draft.send();
    } else if (to && subject && body) {
      GmailApp.sendEmail(to.join(','), subject, body, {
        htmlBody: body
      });
    }
    return Promise.resolve();
  }

  getCurrentUserEmail(): string {
    return Session.getActiveUser().getEmail();
  }
}
