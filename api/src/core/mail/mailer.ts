import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}

/** Outgoing email. Services depend on this, not on a provider. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Production: any SMTP provider (SES, Mailgun, SendGrid SMTP…), configured by SMTP_URL. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to.join(", "),
      subject: message.subject,
      text: message.text,
      attachments: message.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
  }
}

/**
 * Development: writes each email (and its attachments) to a timestamped folder
 * instead of sending it, so scheduled reports can be checked without SMTP.
 */
export class OutboxMailer implements Mailer {
  constructor(private readonly dir: string) {}

  async send(message: MailMessage): Promise<void> {
    const folder = path.resolve(this.dir, `${new Date().toISOString().replace(/[:.]/g, "-")}`);
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, "email.json"),
      JSON.stringify(
        {
          to: message.to,
          subject: message.subject,
          text: message.text,
          attachments: message.attachments?.map((a) => a.filename),
        },
        null,
        2,
      ),
    );
    for (const a of message.attachments ?? [])
      await writeFile(path.join(folder, path.basename(a.filename)), a.content);
  }
}
