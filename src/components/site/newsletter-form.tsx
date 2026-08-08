"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/shared/toast";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Footer newsletter form. Posts to the public subscribe endpoint; a duplicate
 * email is treated as success so the form never leaks who is already signed up.
 */
export function NewsletterForm({ title, text }: { title: string; text: string }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await api.post("/api/newsletter", { email });
      setEmail("");
      toast({
        tone: "success",
        title: "You're on the list",
        description: "We'll email you when something good comes out of the kitchen.",
      });
    } catch (error) {
      toast({
        tone: "error",
        title: "Couldn't sign you up",
        description:
          error instanceof ApiClientError ? error.message : "Please check your email and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-primary-deep-foreground/70">{text}</p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="border-white/20 bg-white/10 text-primary-deep-foreground placeholder:text-primary-deep-foreground/50 focus-visible:ring-offset-transparent"
        />
        <Button type="submit" variant="accent" disabled={pending} className="shrink-0">
          {pending ? "Signing up…" : "Subscribe"}
        </Button>
      </form>
    </div>
  );
}
