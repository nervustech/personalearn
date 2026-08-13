import { NextResponse } from "next/server";
import { isEvalVisionEscalationEnabled } from "@/lib/ai/vision-model";
import {
  getEvalVisionModelId,
  getEvalVisionProvider,
} from "@/lib/evaluation/eval-provider";
import { getSupabaseEnvDiagnostics } from "@/lib/supabase/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "personalearn",
    supabase: getSupabaseEnvDiagnostics(),
    eval: {
      pipeline: "direct-multimodal-adr-005",
      visionProvider: getEvalVisionProvider(),
      visionModel: getEvalVisionModelId(),
      escalation: isEvalVisionEscalationEnabled(),
    },
  });
}
