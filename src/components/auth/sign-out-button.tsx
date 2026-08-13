"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useActiveClassStore } from "@/lib/store/active-class";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const clearActiveClass = useActiveClassStore((state) => state.clearActiveClass);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearActiveClass();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenuItem onClick={handleSignOut} className={cn("gap-1.5", className)}>
      <LogOut className="h-4 w-4 shrink-0" />
      Sign out
    </DropdownMenuItem>
  );
}
