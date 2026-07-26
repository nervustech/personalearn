import { Suspense } from "react";
import { AiHubChat } from "@/components/ai-hub/ai-hub-chat";

export default function AiHubPage() {
  return (
    <div className="-mx-4 mb-[-1.5rem] h-[calc(100dvh-3.75rem)] min-h-[28rem] px-4 md:-mx-6 md:mb-[-2rem] md:h-[calc(100dvh-4rem)] md:min-h-[32rem] md:px-6">
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
