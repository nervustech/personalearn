import { NextResponse } from "next/server";
import { getSupabaseEnvDiagnostics } from "@/lib/supabase/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "personalearn",
    supabase: getSupabaseEnvDiagnostics(),
  });
}
