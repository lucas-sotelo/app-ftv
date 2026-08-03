import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "bg-card text-card-foreground border-input placeholder:text-muted-foreground flex min-h-11 w-full rounded-[var(--radius-app)] border px-3 py-2 text-base",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30 aria-invalid:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "bg-card border-input placeholder:text-muted-foreground flex min-h-20 w-full rounded-[var(--radius-app)] border px-3 py-2 text-base",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
