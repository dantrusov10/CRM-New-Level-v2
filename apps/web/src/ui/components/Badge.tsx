import React from "react";
import clsx from "clsx";

export function Badge({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx("inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-text2", className)} {...rest} />;
}
