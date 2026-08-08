/**
 * SMS delivery behind one interface.
 *
 * The app only ever calls `getSmsSender()`. With no configuration that returns
 * the console sender, which prints the message to the server log — enough to
 * develop and test the whole one-time-code flow before anyone has bought an SMS
 * plan. Setting SMS_PROVIDER plus that provider's credentials switches every
 * send in the app with no other code change.
 *
 * Same shape as `getStorage()` in src/server/storage/index.ts, including the
 * deliberate absence of a vendor SDK: these are two REST calls, and a hand
 * rolled `fetch` keeps the dependency list short.
 */

export interface SmsMessage {
  /** Digits with country code, no spaces — see `normalizePhone`. */
  to: string;
  body: string;
}

export interface SmsSender {
  readonly name: "CONSOLE" | "TWILIO" | "MSG91";
  send(message: SmsMessage): Promise<void>;
}

/**
 * Development sender. Prints the message instead of sending it.
 *
 * This is why the one-time-code flow is testable on day one: run the app, enter
 * a phone number, and read the code out of the terminal.
 */
class ConsoleSmsSender implements SmsSender {
  readonly name = "CONSOLE" as const;

  async send(message: SmsMessage): Promise<void> {
    console.info(
      `\n──── SMS (console sender — not actually sent) ────\n  to:   ${message.to}\n  body: ${message.body}\n─────────────────────────────────────────────────\n`,
    );
  }
}

/** Twilio's REST API. Credentials are Basic auth; the body is form-encoded. */
class TwilioSmsSender implements SmsSender {
  readonly name = "TWILIO" as const;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(message: SmsMessage): Promise<void> {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: message.to.startsWith("+") ? message.to : `+${message.to}`,
          From: this.from,
          Body: message.body,
        }),
      },
    );

    if (!response.ok) {
      // The provider's own error text is useful in the server log but must not
      // reach the caller — it can name the account and the recipient.
      console.error("[sms] twilio send failed:", response.status, await response.text());
      throw new Error("SMS send failed");
    }
  }
}

/**
 * MSG91 — widely used for Indian numbers, and the one that matters for DLT
 * compliance here. Sends via a pre-approved template rather than free text.
 */
class Msg91SmsSender implements SmsSender {
  readonly name = "MSG91" as const;

  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
    private readonly senderId: string | undefined,
  ) {}

  async send(message: SmsMessage): Promise<void> {
    // MSG91's OTP endpoint takes the variable, not the finished sentence — the
    // wording lives in the approved template on their dashboard.
    const code = message.body.match(/\d{4,8}/)?.[0] ?? message.body;

    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey: this.authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: this.templateId,
        mobile: message.to.replace(/\D/g, ""),
        otp: code,
        ...(this.senderId ? { sender: this.senderId } : {}),
      }),
    });

    const result = (await response.json().catch(() => null)) as { type?: string } | null;

    if (!response.ok || result?.type === "error") {
      console.error("[sms] msg91 send failed:", response.status, JSON.stringify(result));
      throw new Error("SMS send failed");
    }
  }
}

// ---------------------------------------------------------------------------

let cached: SmsSender | null = null;

export function getSmsSender(): SmsSender {
  if (cached) return cached;

  const {
    SMS_PROVIDER,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    MSG91_AUTH_KEY,
    MSG91_TEMPLATE_ID,
    MSG91_SENDER_ID,
  } = process.env;

  if (SMS_PROVIDER === "twilio") {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error(
        "SMS_PROVIDER is 'twilio' but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are not all set.",
      );
    }
    cached = new TwilioSmsSender(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER);
  } else if (SMS_PROVIDER === "msg91") {
    if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
      throw new Error(
        "SMS_PROVIDER is 'msg91' but MSG91_AUTH_KEY / MSG91_TEMPLATE_ID are not both set.",
      );
    }
    cached = new Msg91SmsSender(MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, MSG91_SENDER_ID);
  } else {
    cached = new ConsoleSmsSender();
  }

  return cached;
}
