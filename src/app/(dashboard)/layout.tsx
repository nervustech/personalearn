import { AppShell } from "@/components/layout/app-shell";
import { ActiveClassHydrator } from "@/components/classes/active-class-hydrator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <ActiveClassHydrator />
      {children}
    </AppShell>
  );
}
