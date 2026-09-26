export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Stub MVP: registra en memoria (y console) hasta integrar Resend/SMTP. */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    if (process.env.NODE_ENV !== "test") {
      console.info(
        `[email-stub] to=${message.to} subject=${JSON.stringify(message.subject)}`,
      );
    }
  }
}

let shared: MemoryEmailSender | null = null;

export function getEmailSender(): EmailSender {
  if (!shared) {
    shared = new MemoryEmailSender();
  }
  return shared;
}

export function setEmailSenderForTests(sender: EmailSender | null): void {
  shared = sender as MemoryEmailSender | null;
}

export function getMemoryEmailSender(): MemoryEmailSender {
  const sender = getEmailSender();
  if (!(sender instanceof MemoryEmailSender)) {
    throw new Error("Email sender de tests no es MemoryEmailSender");
  }
  return sender;
}
