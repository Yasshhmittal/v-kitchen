"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-controls";
import { otpRequestSchema, otpVerifySchema } from "@/server/validation/schemas";

/**
 * Customer sign-in: phone number, then the code we text back.
 *
 * There is no password anywhere in this flow. The number is the identity, and
 * the code proves they hold it — which is the same thing a password would prove
 * but with nothing to choose, remember, or leak. Name and email are not asked
 * for here; checkout collects those once, the first time they order.
 */

type Step = "phone" | "code";

const RESEND_SECONDS = 30;

export function LoginForm() {
  const searchParams = useSearchParams();
  // Where to land afterwards, e.g. a "sign in to save this" link from checkout.
  const next = searchParams.get("next") || "/account";

  const [step, setStep] = React.useState<Step>("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);

  const codeInputRef = React.useRef<HTMLInputElement>(null);

  // Resend cooldown. Sending an SMS costs money and annoys the recipient, so
  // the button goes quiet for a moment rather than being tappable on repeat.
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  React.useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  /**
   * WebOTP: on Android Chrome this reads the incoming SMS and fills the field
   * without the user leaving the page. Everywhere else it simply never
   * resolves, and `autoComplete="one-time-code"` still gives iOS its
   * keyboard suggestion — so this is a bonus, never a requirement.
   */
  React.useEffect(() => {
    if (step !== "code") return;
    if (!("OTPCredential" in window)) return;

    const controller = new AbortController();

    navigator.credentials
      .get({
        signal: controller.signal,
        // @ts-expect-error — WebOTP is not in the DOM lib types yet.
        otp: { transport: ["sms"] },
      })
      .then((credential) => {
        const received = (credential as { code?: string } | null)?.code;
        if (received) {
          setCode(received);
          void submitCode(received);
        }
      })
      .catch(() => {
        // Aborted or unsupported — the user types it instead.
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function sendCode() {
    if (pending) return;

    const parsed = otpRequestSchema.safeParse({ phone });
    if (!parsed.success) {
      setFieldError(parsed.error.errors[0]?.message ?? "Enter a valid phone number");
      return;
    }

    setPending(true);
    setFormError(null);
    setFieldError(null);

    try {
      const result = await api.post<{ sent: boolean; devCode?: string }>(
        "/api/auth/otp/request",
        { phone },
      );
      setDevCode(result.devCode ?? null);
      setSecondsLeft(RESEND_SECONDS);
      setStep("code");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "We couldn't send the code. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitCode(value: string) {
    if (pending) return;

    const parsed = otpVerifySchema.safeParse({ phone, code: value });
    if (!parsed.success) {
      setFieldError(parsed.error.errors[0]?.message ?? "Enter the 6-digit code");
      return;
    }

    setPending(true);
    setFormError(null);
    setFieldError(null);

    try {
      await api.post("/api/auth/otp/verify", { phone, code: value });
      // A full navigation, not a client push: the layout reads the session on
      // the server, so it has to re-render for the header to know who you are.
      window.location.assign(next);
    } catch (error) {
      setFieldError(
        error instanceof ApiClientError
          ? error.message
          : "That code didn't work. Please try again.",
      );
      setPending(false);
    }
  }

  async function resend() {
    if (secondsLeft > 0 || pending) return;
    setCode("");
    await sendCode();
  }

  /* ---------------------------------------------------------------- phone */

  if (step === "phone") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendCode();
        }}
        className="space-y-4"
        noValidate
      >
        <div>
          <h2 className="font-display text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your phone number and we&rsquo;ll text you a code. No password needed.
          </p>
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {formError}
          </p>
        )}

        <Field
          label="Phone number"
          htmlFor="login-phone"
          error={fieldError ?? undefined}
          required
        >
          <Input
            id="login-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            autoFocus
            placeholder="9876543210"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Send code
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Ordered as a guest?{" "}
          <Link href="/track" className="font-medium text-primary hover:underline">
            Track that order
          </Link>{" "}
          with your order number.
        </p>
      </form>
    );
  }

  /* ----------------------------------------------------------------- code */

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitCode(code);
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <h2 className="font-display text-xl font-bold">Enter your code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{phone}</span>.
        </p>
      </div>

      {devCode && (
        <p className="rounded-xl bg-accent/10 p-3 text-sm text-foreground">
          <span className="font-semibold">Development mode:</span> your code is{" "}
          <span className="font-mono font-bold tracking-widest">{devCode}</span>. Configure
          SMS_PROVIDER to send real messages.
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      )}

      <Field label="6-digit code" htmlFor="login-code" error={fieldError ?? undefined} required>
        <Input
          id="login-code"
          ref={codeInputRef}
          type="text"
          // The pair that makes iOS offer the code above the keyboard and lets
          // Android fill it automatically.
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          className="text-center font-mono text-lg tracking-[0.4em]"
          value={code}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            setFieldError(null);
            // Submit as soon as it's complete — one less tap on a phone.
            if (digits.length === 6) void submitCode(digits);
          }}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Verify and continue
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setFieldError(null);
            setDevCode(null);
          }}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Change number
        </button>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={secondsLeft > 0 || pending}
          className="font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
