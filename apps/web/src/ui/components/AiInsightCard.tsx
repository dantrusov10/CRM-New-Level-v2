import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/cn";

/** MagicUI-inspired animated border + shimmer (lightweight, no shadcn dependency). */
export function AiInsightCard({
  title,
  subtitle,
  text,
  loading,
  error,
  onRefresh,
  refreshLabel = "Обновить AI-вывод",
}: {
  title: string;
  subtitle: string;
  text: string;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  refreshLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative mt-6 rounded-[16px] p-[1px] overflow-hidden"
      style={{
        background: "linear-gradient(120deg, rgba(51,215,255,0.2), rgba(51,215,255,0.85), rgba(87,183,255,0.2))",
      }}
    >
      <div
        className="absolute inset-0 opacity-60 pointer-events-none ai-border-beam"
        aria-hidden
      />
      <div className="relative ui-card p-4 neon-accent bg-[#071A33]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold inline-flex items-center gap-2">
              <Sparkles size={16} className="text-primary shrink-0" />
              <span className={cn(loading && "ai-shimmer-text")}>{title}</span>
            </div>
            <div className="text-xs text-text2 mt-1">{subtitle}</div>
          </div>
          <Button small variant="secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Обновление..." : refreshLabel}
          </Button>
        </div>
        {error ? <div className="mt-2 text-xs text-danger">{error}</div> : null}
        <div className="mt-3 relative min-h-[4.5rem]">
          {loading ? (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              <div className="h-3 rounded-md bg-[rgba(255,255,255,0.08)] w-full" />
              <div className="h-3 rounded-md bg-[rgba(255,255,255,0.08)] w-[92%]" />
              <div className="h-3 rounded-md bg-[rgba(255,255,255,0.08)] w-[78%]" />
            </motion.div>
          ) : (
            <motion.p
              key={text.slice(0, 40)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="whitespace-pre-wrap text-sm text-text"
            >
              {text || "Готовим вывод..."}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
