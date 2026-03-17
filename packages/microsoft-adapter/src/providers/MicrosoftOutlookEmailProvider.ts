import { EmailProvider } from '@universal-email/core';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export class MicrosoftOutlookEmailProvider implements EmailProvider {
  private client: Client;
  private userEmail: string;

  constructor(client: Client, userEmail: string) {
    this.client = client;
    this.userEmail = userEmail;
  }

  async createDraft(
    subject: string, 
    body: string, 
    to: string[], 
    cc?: string[], 
    bcc?: string[], 
    htmlBody?: string
  ): Promise<string> {
    const draftMessage = {
      subject,
      body: {
        contentType: htmlBody ? 'html' : 'text',
        content: htmlBody || body,
      },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
      bccRecipients: bcc?.map(email => ({ emailAddress: { address: email } })),
    };

    const response = await this.client
      .api('/me/messages')
      .post(draftMessage);

    return response.id;
  }

  async updateDraft(draftId: string, subject: string, body: string, htmlBody?: string): Promise<void> {
    const updatedMessage = {
      subject,
      body: {
        contentType: htmlBody ? 'html' : 'text',
        content: htmlBody || body,
      },
    };

    await this.client
      .api(`/me/messages/${draftId}`)
      .patch(updatedMessage);
  }

  async findDraftBySubject(subject: string): Promise<string | null> {
    const response = await this.client
      .api('/me/messages')
      .filter(`subject eq '${subject.replace(/'/g, "''")}' and isDraft eq true`)
      .get();

    if (response.value && response.value.length > 0) {
      return response.value[0].id;
    }
    return null;
  }

  async findThreadBySubject(subject: string): Promise<string | null> {
    // Microsoft Graph doesn't have a direct "find thread by subject" equivalent that works exactly like Gmail's,
    // but we can search for messages with that subject.
    const response = await this.client
      .api('/me/messages')
      .filter(`subject eq '${subject.replace(/'/g, "''")}'`)
      .select('conversationId')
      .top(1)
      .get();

    if (response.value && response.value.length > 0) {
      return response.value[0].id; // We return the message ID to reply to
    }
    return null;
  }

  async createReplyDraft(
    messageId: string, 
    body: string, 
    cc?: string[], 
    bcc?: string[], 
    htmlBody?: string
  ): Promise<string> {
    // 1. Create a reply draft from existing message
    const response = await this.client
      .api(`/me/messages/${messageId}/createReply`)
      .post({});

    const draftId = response.id;

    // 2. Update the draft with our custom body and recipients
    const updatePayload: any = {
      body: {
        contentType: htmlBody ? 'html' : 'text',
        content: htmlBody || body,
      }
    };

    if (cc) updatePayload.ccRecipients = cc.map(email => ({ emailAddress: { address: email } }));
    if (bcc) updatePayload.bccRecipients = bcc.map(email => ({ emailAddress: { address: email } }));

    await this.client
      .api(`/me/messages/${draftId}`)
      .patch(updatePayload);

    return draftId;
  }

  async sendEmail(draftId?: string): Promise<void> {
    if (!draftId) throw new Error('draftId is required for Microsoft Graph sendEmail');
    
    await this.client
      .api(`/me/messages/${draftId}/send`)
      .post({});
  }

  getCurrentUserEmail(): string {
    return this.userEmail;
  }
}
