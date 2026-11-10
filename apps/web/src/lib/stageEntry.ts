import dayjs from "dayjs";
import { pb } from "./pb";
import type { FunnelStage } from "./types";
import { payloadStageToken, stageMatchesToken } from "./reportBuilder";

/**
 * Deal IDs that entered given stage(s) during [from, to] via timeline stage_change.
 * Also includes deals created already in target stage during the period (no stage_change).
 */
export async function fetchDealIdsEnteredStages(opts: {
  from: Date;
  to?: Date;
  stages: FunnelStage[];
  stageFilterId?: string;
}): Promise<Set<string>> {
  const { from, to, stages, stageFilterId } = opts;
  const targetStages = stageFilterId
    ? stages.filter((s) => String(s.id) === String(stageFilterId))
    : stages.filter((s) => {
        const ft = String(s.final_type || "").toLowerCase();
        const name = String(s.stage_name || "").toLowerCase();
        return ft === "lost" || ft === "lose" || /(отказ|проиг|потер|нецелес)/.test(name);
      });
  if (!targetStages.length) return new Set();

  const fromStr = dayjs(from).format("YYYY-MM-DD HH:mm:ss");
  const toStr = dayjs(to || new Date()).endOf("day").format("YYYY-MM-DD HH:mm:ss");
  const filter = `action="stage_change" && timestamp>="${fromStr}" && timestamp<="${toStr}"`;
  const events = await pb
    .collection("timeline")
    .getFullList({ filter, fields: "deal_id,payload,timestamp", batch: 500 })
    .catch(() => []);

  const ids = new Set<string>();
  for (const ev of events as Array<{ deal_id?: string; payload?: unknown }>) {
    const token = payloadStageToken(ev.payload);
    if (!token) continue;
    const hit = targetStages.some((s) => stageMatchesToken(s, token));
    if (hit && ev.deal_id) ids.add(String(ev.deal_id));
  }

  // creations already in target stage
  const stageOr = targetStages.map((s) => `stage_id="${s.id}"`).join(" || ");
  if (stageOr) {
    const created = await pb
      .collection("deals")
      .getFullList({
        filter: `(${stageOr}) && created>="${fromStr}" && created<="${toStr}"`,
        fields: "id",
        batch: 500,
      })
      .catch(() => []);
    for (const d of created as Array<{ id?: string }>) {
      if (d.id) ids.add(String(d.id));
    }
  }

  return ids;
}
