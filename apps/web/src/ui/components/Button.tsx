import React from "react";
import clsx from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  small?: boolean;
};

/**
 * Calm Power UI (cockpit) button styles.
 * Keeps the same API so we don't touch functionality.
 */
export function Button({ variant = "primary", small, className, ...rest }: Props) {
  const base = "glass-btn disabled:opacity-50 disabled:cursor-not-allowed";
  const h = small ? "h-9 text-sm" : "h-10 text-sm";
  const v =
    variant === "primary"
      ? "glass-primary"
      : variant === "secondary"
        ? "" // default glass-btn is fine
        : "bg-red-500/80 border-red-200/20 hover:bg-red-500/90";
  return <button className={clsx(base, h, v, className)} {...rest} />;
}
