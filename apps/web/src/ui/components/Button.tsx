import React from "react";
import clsx from "clsx";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  small?: boolean;
};

export function Button({ variant = "primary", small, className, ...rest }: Props) {
  const base = "nwl-btn inline-flex items-center justify-center gap-2 font-semibold";
  const h = small ? "h-9 text-sm" : "h-10 text-sm";
  const v =
    variant === "primary"
      ? "bg-primary text-white hover:bg-primaryHover disabled:bg-primaryDisabled"
      : variant === "secondary"
        ? "bg-white border border-borderHover text-text hover:bg-rowHover hover:border-[#6B7280]"
        : "bg-danger text-white hover:opacity-90";
  return <button className={clsx(base, h, v, className)} {...rest} />;
}
