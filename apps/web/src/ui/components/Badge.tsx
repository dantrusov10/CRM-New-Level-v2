import React from "react";
import { cn } from "../../lib/cn";

export function Badge({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-text2", className)} {...rest} />;
}
