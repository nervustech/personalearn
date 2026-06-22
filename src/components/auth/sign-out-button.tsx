"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useActiveClassStore } from "@/lib/store/active-class";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
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
    <DropdownMenuItem onClick={handleSignOut}>
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </DropdownMenuItem>
  );
}
