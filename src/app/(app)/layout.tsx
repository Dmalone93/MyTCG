import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { NavLinks } from "@/components/nav-links";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3.5 px-[clamp(12px,3.5vw,20px)] py-[clamp(14px,3.5vw,22px)]">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-[22px] leading-none tracking-tight text-text">
            MyTCG
          </h1>
          <NavLinks />
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-sm text-text-muted">
            {user.firstName ?? user.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton />
        </div>
      </header>

      <main className="flex-1 px-[clamp(12px,3.5vw,20px)] pb-16 max-w-[1280px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
