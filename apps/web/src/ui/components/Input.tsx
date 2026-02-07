import React from "react";
import clsx from "clsx";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  tone?: "light" | "dark"; // optional; default light for forms
};

export function Input({ className, error, tone = "light", ...rest }: Props) {
  const base = tone === "dark" ? "glass-field" : "glass-field-light";
  return (
    <div className="w-full">
      <input
        className={clsx(
          base,
          error ? "border-red-400/60 bg-red-500/10" : tone === "dark" ? "focus:border-white/30" : "focus:border-blue-500/40",
          className
        )}
        {...rest}
      />
      {error ? <div className="mt-1 text-xs text-red-200/90">{error}</div> : null}
    </div>
  );
}
