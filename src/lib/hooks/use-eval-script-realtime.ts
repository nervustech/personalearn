"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { evaluationScriptsQueryKey } from "@/lib/hooks/use-evaluation";
import { createClient } from "@/lib/supabase/client";

/** Subscribe to evaluated_scripts changes for a batch (ADR-004 §7). */
export function useEvalScriptRealtime(batchId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!batchId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`eval-scripts:${batchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "evaluated_scripts",
          filter: `batch_id=eq.${batchId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: evaluationScriptsQueryKey(batchId),
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [batchId, queryClient]);
}
