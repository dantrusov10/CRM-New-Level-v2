import React from "react";
import clsx from "clsx";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ className, error, ...rest }: Props) {
  return (
    <div className="w-full">
      <input
        className={clsx(
          "ui-input text-sm",
          error ? "border-[rgba(239,68,68,0.55)] bg-[rgba(239,68,68,0.08)]" : "",
          className
        )}
        {...rest}
      />
      {error ? <div className="mt-1 text-xs text-[rgba(239,68,68,0.95)] font-semibold">{error}</div> : null}
    </div>
  );
}
