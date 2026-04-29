import React from "react";
import clsx from "clsx";

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("ui-card", className)} {...rest} />;
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-4 py-3 border-b border-[rgba(255,255,255,0.12)]", className)} {...rest} />;
}

export function CardContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("px-4 py-4", className)} {...rest} />;
}
