import { NextResponse } from "next/server";
import { getEvalVisionModelId, isEvalVisionEscalationEnabled } from "@/lib/ai/vision-model";
import { getSupabaseEnvDiagnostics } from "@/lib/supabase/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "personalearn",
    supabase: getSupabaseEnvDiagnostics(),
    eval: {
      pipeline: "direct-multimodal-adr-005",
      visionModel: getEvalVisionModelId(),
      escalation: isEvalVisionEscalationEnabled(),
    },
  });
}
