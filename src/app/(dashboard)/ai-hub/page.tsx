import { Suspense } from "react";
import { AiHubChat } from "@/components/ai-hub/ai-hub-chat";

export default function AiHubPage() {
  return (
    <div className="h-[calc(100dvh-8rem)] min-h-[32rem]">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading AI Hub…</p>
        }
      >
        <AiHubChat />
      </Suspense>
    </div>
  );
}
