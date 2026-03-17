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
    bcc?: string[],
    htmlBody?: string
  ): Promise<string> {
    const draft = GmailApp.createDraft(
      to.join(','),
      subject,
      body,
      {
        cc: cc?.join(','),
        bcc: bcc?.join(','),
        htmlBody: htmlBody
      }
    );
    return Promise.resolve(draft.getId());
  }

  updateDraft(draftId: string, subject: string, body: string, htmlBody?: string): Promise<void> {
    const draft = GmailApp.getDraft(draftId);
    draft.update(draft.getMessage().getTo(), subject, body, {
      htmlBody: htmlBody
    });
    return Promise.resolve();
  }

  async findDraftBySubject(subject: string): Promise<string | null> {
    const drafts = GmailApp.getDrafts();
    for (const draft of drafts) {
      const message = draft.getMessage();
      const draftSubject = message.getSubject();
      if (draftSubject && draftSubject.includes(subject)) {
        return draft.getId();
      }
    }
    return null;
  }

  async findThreadBySubject(subject: string): Promise<string | null> {
    const threads = GmailApp.search(`subject:"${subject}"`, 0, 5);
    for (const thread of threads) {
      const originalSubject = thread.getFirstMessageSubject();
      // Skip OOO and auto-replies
      if (!originalSubject.match(/^(Automatic reply|OOO|Out of Office|Absence Notice):/i)) {
        return thread.getId();
      }
    }
    return null;
  }

  async createReplyDraft(
    threadId: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    htmlBody?: string
  ): Promise<string> {
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) {
      throw new Error(`Thread with ID ${threadId} not found`);
    }

    const draft = thread.createDraftReplyAll(body, {
      htmlBody: htmlBody,
      cc: cc?.join(','),
      bcc: bcc?.join(',')
    });
    
    return draft.getId();
  }

  async sendEmail(
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
