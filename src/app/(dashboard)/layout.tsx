import { AppShell } from "@/components/layout/app-shell";
import { ActiveClassHydrator } from "@/components/classes/active-class-hydrator";
import { EvalUploadFloatingIndicator } from "@/components/classes/eval-upload-progress";
import { EvalUploadQueueProvider } from "@/lib/hooks/use-eval-upload-queue";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EvalUploadQueueProvider>
      <AppShell>
        <ActiveClassHydrator />
        {children}
        <EvalUploadFloatingIndicator />
      </AppShell>
    </EvalUploadQueueProvider>
  );
}
