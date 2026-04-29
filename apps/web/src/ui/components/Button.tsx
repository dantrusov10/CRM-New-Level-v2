import React from "react";
import clsx from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  small?: boolean;
};

export function Button({ variant = "primary", small, className, ...rest }: Props) {
  const base = "ui-btn";
  const h = small ? "h-9 text-sm" : "h-[42px] text-sm";
  const v =
    variant === "primary"
      ? "ui-btn-primary"
      : variant === "secondary"
        ? "ui-btn-secondary"
        : "ui-btn-danger";
  return <button className={clsx(base, h, v, className)} {...rest} />;
}
