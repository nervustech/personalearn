import { CopilotPanel } from "@/components/ai/copilot-panel";

export default function AiHubPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">AI Hub</h1>
        <p className="text-muted-foreground">
          Class-scoped co-pilot — ask questions grounded in your uploaded
          materials.
        </p>
      </div>
      <CopilotPanel />
    </div>
  );
}
