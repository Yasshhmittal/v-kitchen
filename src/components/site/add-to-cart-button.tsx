"use client";

import * as React from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/shared/toast";
import { useCart, type CartAddInput } from "@/hooks/use-cart";
import { useSiteConfig } from "@/hooks/use-site-config";
import { cn } from "@/lib/cn";

/**
 * Add-to-cart control shared by menu items and products.
 *
 * Flips to a tick for a moment after adding — the toast is easy to miss on a
 * phone, and the button is where the user is already looking. Disabled
 * entirely when the owner has paused ordering.
 */
export function AddToCartButton({
  item,
  disabled,
  disabledReason,
  className,
  size = "sm",
  variant = "default",
  label = "Add",
  showIcon = true,
}: {
  item: CartAddInput;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  label?: string;
  showIcon?: boolean;
}) {
  const { add } = useCart();
  const { toast } = useToast();
  const { orderingEnabled } = useSiteConfig();
  const [justAdded, setJustAdded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const blocked = disabled || !orderingEnabled;

  function onClick() {
    if (blocked) return;
    add(item);
    setJustAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1600);
    toast({
      tone: "success",
      title: `${item.name} added`,
      description: "Open your cart when you're ready to check out.",
    });
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={blocked}
      className={cn(justAdded && "bg-success hover:bg-success", className)}
      title={blocked ? disabledReason : undefined}
      aria-label={blocked ? disabledReason : `Add ${item.name} to cart`}
    >
      {showIcon &&
        (justAdded ? (
          <Check className="size-4" aria-hidden />
        ) : blocked ? (
          <ShoppingBag className="size-4" aria-hidden />
        ) : (
          <Plus className="size-4" aria-hidden />
        ))}
      {justAdded ? "Added" : blocked ? (disabledReason ?? "Unavailable") : label}
    </Button>
  );
}
