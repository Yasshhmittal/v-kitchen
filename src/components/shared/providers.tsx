"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { CartProvider } from "@/hooks/use-cart";
import { ToastProvider } from "./toast";

/**
 * Every client-side context the app needs, mounted once in the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Created once per browser session — a new QueryClient on each render would
  // discard the cache on every state change.
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <ToastProvider>{children}</ToastProvider>
        </CartProvider>
      </QueryClientProvider>
    </NextThemesProvider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // The server has no idea which theme the browser will resolve to, so render
  // a neutral placeholder until hydration to avoid a mismatch.
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-[1.15rem]" />
        ) : (
          <Moon className="size-[1.15rem]" />
        )
      ) : (
        <span className="size-[1.15rem]" />
      )}
    </Button>
  );
}
