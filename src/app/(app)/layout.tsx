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
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-[clamp(12px,3.5vw,20px)] sm:py-[clamp(14px,3.5vw,22px)]">
        <div className="flex items-center gap-3 sm:gap-4">
          <h1 className="font-bold text-lg sm:text-[22px] leading-none tracking-tight text-text">
            MyTCG
          </h1>
          <NavLinks />
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <span className="text-xs sm:text-sm text-text-muted hidden sm:inline">
            {user.firstName ?? user.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton />
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-[clamp(12px,3.5vw,20px)] pb-16 max-w-[1280px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
