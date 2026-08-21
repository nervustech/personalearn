"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useActiveClassStore } from "@/lib/store/active-class";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  variant = "menu",
}: {
  className?: string;
  variant?: "menu" | "hero";
}) {
  const router = useRouter();
  const clearActiveClass = useActiveClassStore((state) => state.clearActiveClass);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearActiveClass();
    router.push("/login");
    router.refresh();
  }

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        className={cn(buttonVariants({ variant: "hero", size: "sm" }), className)}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sign out
      </button>
    );
  }

  return (
    <DropdownMenuItem onClick={handleSignOut} className={cn("gap-1.5", className)}>
      <LogOut className="h-4 w-4 shrink-0" />
      Sign out
    </DropdownMenuItem>
  );
}
