"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Minimal toast system. `useToast().toast({...})` from anywhere in a client
 * component; the provider lives once in the root layout.
 */

type ToastTone = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: { title: string; description?: string; tone?: ToastTone }) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const TONE_META: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: "text-success" },
  error: { icon: AlertCircle, className: "text-destructive" },
  info: { icon: Info, className: "text-primary" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);
  const nextId = React.useRef(0);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    ({ title, description, tone = "info" }) => {
      nextId.current += 1;
      const id = nextId.current;
      setMessages((current) => [...current, { id, title, description, tone }]);
    },
    [],
  );

  const dismiss = React.useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {messages.map((message) => {
          const { icon: Icon, className } = TONE_META[message.tone];
          return (
            <ToastPrimitive.Root
              key={message.id}
              onOpenChange={(open) => !open && dismiss(message.id)}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-card p-4 shadow-lift",
                "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-80",
                "data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full",
                "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {message.title}
                </ToastPrimitive.Title>
                {message.description && (
                  <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                    {message.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="pointer-events-none fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:top-0 sm:flex-col sm:max-w-sm" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
