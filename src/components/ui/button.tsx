import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  asChild?: false; // simplified: we’re not using Radix Slot here
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:pointer-events-none disabled:opacity-50";
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default: "bg-indigo-600 text-white hover:bg-indigo-500 px-4 py-2",
      outline:
        "border border-zinc-600 text-zinc-100 hover:border-indigo-400/60 px-3 py-1.5 bg-transparent",
      ghost: "hover:bg-zinc-800/40 px-3 py-1.5",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
