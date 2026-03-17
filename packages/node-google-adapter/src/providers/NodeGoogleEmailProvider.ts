import { EmailProvider } from '@universal-email/core';
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class NodeGoogleEmailProvider implements EmailProvider {
  private gmail: gmail_v1.Gmail;
  private userEmail: string;

  constructor(auth: any, userEmail: string = 'me') {
    this.gmail = google.gmail({ version: 'v1', auth });
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
    const rawMessage = this.createRawMessage(subject, body, to, cc, bcc, htmlBody);
    
    const response = await this.gmail.users.drafts.create({
      userId: this.userEmail,
      requestBody: {
        message: {
          raw: Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        }
      }
    });

    return response.data.id || '';
  }

  async updateDraft(draftId: string, subject: string, body: string, htmlBody?: string): Promise<void> {
    // To update a draft, we need to know the recipients. 
    // In a real implementation, we'd fetch the draft first to get the 'To' header.
    // Simplified for this adapter:
    const rawMessage = this.createRawMessage(subject, body, [], [], [], htmlBody);

    await this.gmail.users.drafts.update({
      userId: this.userEmail,
      id: draftId,
      requestBody: {
        message: {
          raw: Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        }
      }
    });
  }

  async findDraftBySubject(subject: string): Promise<string | null> {
    const response = await this.gmail.users.drafts.list({
      userId: this.userEmail,
      q: `subject:"${subject}"`
    });

    if (response.data.drafts && response.data.drafts.length > 0) {
      return response.data.drafts[0].id || null;
    }
    return null;
  }

  async findThreadBySubject(subject: string): Promise<string | null> {
    const response = await this.gmail.users.threads.list({
      userId: this.userEmail,
      q: `subject:"${subject}"`,
      maxResults: 1
    });

    if (response.data.threads && response.data.threads.length > 0) {
      return response.data.threads[0].id || null;
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
    // 1. Fetch the thread to get the subject and messages
    const thread = await this.gmail.users.threads.get({
      userId: this.userEmail,
      id: threadId
    });

    const messages = thread.data.messages || [];
    const lastMessage = messages[messages.length - 1];
    const subject = this.getHeader(lastMessage, 'Subject') || '';
    const messageId = this.getHeader(lastMessage, 'Message-ID') || '';
    const threadIdHeader = this.getHeader(lastMessage, 'Thread-Id') || threadId;

    // 2. Construct raw reply message
    // Note: We'd normally handle 'In-Reply-To' and 'References' headers
    const rawMessage = this.createRawMessage(subject, body, [], cc, bcc, htmlBody, messageId, threadIdHeader);

    const response = await this.gmail.users.drafts.create({
      userId: this.userEmail,
      requestBody: {
        message: {
          threadId: threadId,
          raw: Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        }
      }
    });

    return response.data.id || '';
  }

  async sendEmail(draftId?: string): Promise<void> {
    if (!draftId) throw new Error('draftId is required for NodeGoogle sendEmail');
    
    await this.gmail.users.drafts.send({
      userId: this.userEmail,
      requestBody: {
        id: draftId
      }
    });
  }

  getCurrentUserEmail(): string {
    return this.userEmail === 'me' ? 'default-authorized-user@google.com' : this.userEmail;
  }

  private createRawMessage(
    subject: string, 
    body: string, 
    to: string[], 
    cc?: string[], 
    bcc?: string[], 
    htmlBody?: string,
    inReplyTo?: string,
    references?: string
  ): string {
    const boundary = 'foo_bar_baz';
    let message = [
      `Subject: ${subject}`,
      `To: ${to.join(', ')}`,
      cc ? `Cc: ${cc.join(', ')}` : '',
      bcc ? `Bcc: ${bcc.join(', ')}` : '',
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
      references ? `References: ${references}` : '',
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody || body,
      '',
      `--${boundary}--`
    ].filter(line => line !== '').join('
');

    return message;
  }

  private getHeader(message: gmail_v1.Schema$Message, name: string): string | undefined {
    return message.payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
  }
}
