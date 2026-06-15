"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center justify-center h-10 px-3 bg-bg-surface text-text-muted border border-[rgba(255,255,255,0.06)] rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-[#27272A] hover:text-text transition-colors"
    >
      Sign out
    </button>
  );
}
