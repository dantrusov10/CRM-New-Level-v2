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
          "h-10 w-full rounded-card border bg-white px-3 text-sm outline-none transition-colors",
          error ? "border-danger ring-0 bg-dangerBg" : "border-[#9CA3AF] focus:border-primary focus:ring-0",
          className
        )}
        {...rest}
      />
      {error ? <div className="mt-1 text-xs text-danger">{error}</div> : null}
    </div>
  );
}
