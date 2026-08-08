/**
 * Email delivery behind one interface — the sibling of `getSmsSender()`.
 *
 * With no configuration this prints to the server log, so the order-receipt
 * flow is testable before anyone has bought a mail plan. Setting MAIL_PROVIDER
 * plus that provider's credentials switches every send with no other code
 * change.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Both parts are always supplied — see `renderOrderReceipt`. */
  html: string;
  text: string;
}

export interface MailSender {
  readonly name: "CONSOLE" | "RESEND" | "SMTP";
  send(message: MailMessage): Promise<void>;
}

function fromAddress(): string {
  return process.env.MAIL_FROM || "V-Kitchen <onboarding@resend.dev>";
}

class ConsoleMailSender implements MailSender {
  readonly name = "CONSOLE" as const;

  async send(message: MailMessage): Promise<void> {
    console.info(
      `\n──── EMAIL (console sender — not actually sent) ────\n  to:      ${message.to}\n  from:    ${fromAddress()}\n  subject: ${message.subject}\n\n${message.text}\n───────────────────────────────────────────────────\n`,
    );
  }
}

/** Resend's REST API — one JSON POST, no SDK needed. */
class ResendMailSender implements MailSender {
  readonly name = "RESEND" as const;

  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      console.error("[mail] resend send failed:", response.status, await response.text());
      throw new Error("Email send failed");
    }
  }
}

// ---------------------------------------------------------------------------

let cached: MailSender | null = null;

export function getMailSender(): MailSender {
  if (cached) return cached;

  const { MAIL_PROVIDER, RESEND_API_KEY } = process.env;

  if (MAIL_PROVIDER === "resend") {
    if (!RESEND_API_KEY) {
      throw new Error("MAIL_PROVIDER is 'resend' but RESEND_API_KEY is not set.");
    }
    cached = new ResendMailSender(RESEND_API_KEY);
  } else {
    cached = new ConsoleMailSender();
  }

  return cached;
}
