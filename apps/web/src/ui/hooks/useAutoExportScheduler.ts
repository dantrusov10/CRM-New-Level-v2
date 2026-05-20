import React from "react";
import { useLocation } from "react-router-dom";
import {
  deliverExportByEmail,
  loadAutoExportJobs,
  runKeyForNow,
  saveAutoExportJobs,
  searchParamsFromSnapshot,
  shouldRunAutoExport,
} from "../../lib/autoExport";
import { downloadExportResult, runExport } from "../../lib/exportRunner";

export function useAutoExportScheduler() {
  const location = useLocation();

  React.useEffect(() => {
    const tick = async () => {
      const jobs = loadAutoExportJobs();
      const now = new Date();
      for (const job of jobs) {
        if (!shouldRunAutoExport(job, now)) continue;
        try {
          const sp = searchParamsFromSnapshot(job.filterSnapshot);
          const result = await runExport({
            entity: job.entity,
            format: job.format,
            fields: job.fields,
            timelineFields: job.timelineFields,
            useCurrentFilters: job.useCurrentFilters,
            searchParams: sp,
          });
          downloadExportResult(result);
          if (job.emails?.length) {
            await deliverExportByEmail(job.emails, result.blob, result.filename);
          }
          const next = jobs.map((j) =>
            j.id === job.id ? { ...j, lastRunKey: runKeyForNow(now), lastRunAt: now.toISOString() } : j,
          );
          saveAutoExportJobs(next);
        } catch (e) {
          console.warn("[auto-export]", job.name, e);
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 60_000);
    return () => window.clearInterval(id);
  }, [location.pathname]);
}
