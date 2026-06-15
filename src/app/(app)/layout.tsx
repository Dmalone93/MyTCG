import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3.5 px-[clamp(12px,3.5vw,20px)] py-[clamp(14px,3.5vw,22px)]">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-[22px] leading-none tracking-tight text-text">
            MyTCG
          </h1>
          <NavLinks />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-text-muted">
            {profile?.display_name ?? user.email}
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-[clamp(12px,3.5vw,20px)] pb-16 max-w-[1280px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
