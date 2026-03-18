import { EmailProvider } from '@universal-email/core';
import { Client } from '@microsoft/microsoft-graph-client';

export class NodeMicrosoftEmailProvider implements EmailProvider {
  private client: Client;
  private userEmail: string;
  private cachedUserEmail: string;

  constructor(graphClient: Client, userEmail?: string) {
    this.client = graphClient;
    this.userEmail = userEmail || 'me';
    this.cachedUserEmail = '';
    
    this.initializeUserEmail();
  }

  private async initializeUserEmail(): Promise<void> {
    try {
      const user = await this.client
        .api('/me')
        .select('mail,userPrincipalName')
        .get();
      this.cachedUserEmail = user.mail || user.userPrincipalName;
    } catch (error) {
      this.cachedUserEmail = this.userEmail;
    }
  }

  async createDraft(
    subject: string,
    body: string,
    to: string[],
    cc?: string[],
    bcc?: string[],
    htmlBody?: string,
  ): Promise<string> {
    const message = {
      subject,
      body: {
        contentType: htmlBody ? 'HTML' : 'Text',
        content: htmlBody || body,
      },
      toRecipients: to.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients: cc?.map((email) => ({
        emailAddress: { address: email },
      })),
      bccRecipients: bcc?.map((email) => ({
        emailAddress: { address: email },
      })),
      isDraft: true,
    };

    const response = await this.client
      .api('/me/mailFolders/drafts/messages')
      .post(message);

    return response.id;
  }

  async updateDraft(
    draftId: string,
    subject: string,
    body: string,
    htmlBody?: string,
  ): Promise<void> {
    const update = {
      subject,
      body: {
        contentType: htmlBody ? 'HTML' : 'Text',
        content: htmlBody || body,
      },
    };

    await this.client
      .api(`/me/messages/${draftId}`)
      .patch(update);
  }

  async findDraftBySubject(subject: string): Promise<string | null> {
    const response = await this.client
      .api('/me/mailFolders/drafts/messages')
      .filter(`subject eq '${subject}'`)
      .select('id')
      .top(1)
      .get();

    if (response.value && response.value.length > 0) {
      return response.value[0].id;
    }
    return null;
  }

  async findThreadBySubject(subject: string): Promise<string | null> {
    const response = await this.client
      .api('/me/messages')
      .filter(`subject eq '${subject}'`)
      .select('id,conversationId')
      .top(1)
      .get();

    if (response.value && response.value.length > 0) {
      return response.value[0].conversationId;
    }
    return null;
  }

  async createReplyDraft(
    threadId: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    htmlBody?: string,
  ): Promise<string> {
    const messages = await this.client
      .api('/me/messages')
      .filter(`conversationId eq '${threadId}'`)
      .select('id')
      .top(1)
      .get();

    if (!messages.value || messages.value.length === 0) {
      throw new Error('Thread not found');
    }

    const parentMessageId = messages.value[0].id;

    const reply = await this.client
      .api(`/me/messages/${parentMessageId}/createReply`)
      .post({});

    const update = {
      body: {
        contentType: htmlBody ? 'HTML' : 'Text',
        content: htmlBody || body,
      },
      ccRecipients: cc?.map((email) => ({
        emailAddress: { address: email },
      })),
      bccRecipients: bcc?.map((email) => ({
        emailAddress: { address: email },
      })),
    };

    await this.client
      .api(`/me/messages/${reply.id}`)
      .patch(update);

    return reply.id;
  }

  async sendEmail(
    draftId?: string,
    to?: string[],
    subject?: string,
    body?: string,
  ): Promise<void> {
    if (draftId) {
      await this.client
        .api(`/me/messages/${draftId}/send`)
        .post({});
    } else if (to && subject && body) {
      const message = {
        subject,
        body: {
          contentType: 'Text',
          content: body,
        },
        toRecipients: to.map((email) => ({
          emailAddress: { address: email },
        })),
      };

      await this.client
        .api('/me/sendMail')
        .post({ message });
    } else {
      throw new Error('Either draftId or (to, subject, body) must be provided');
    }
  }

  getCurrentUserEmail(): string {
    return this.cachedUserEmail || this.userEmail;
  }
}
