import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { NavLinks } from "@/components/nav-links";
import Link from "next/link";
import { RegionPicker } from "@/components/region-selector";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex-none mr-1">
            <img src="/logo.svg" alt="MyTCG" className="h-5" />
          </Link>
          <NavLinks />
          <div className="flex-1" />
          <Link
            href="/search"
            className="hidden sm:flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-1.5 text-text-dim text-sm hover:border-[rgba(0,0,0,0.15)] hover:text-text-muted transition-colors min-w-[180px] shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search cards
          </Link>
          <Link
            href="/search"
            className="sm:hidden p-2 rounded-lg text-text-muted hover:text-text active:opacity-70 transition-colors"
            title="Search cards"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </Link>
          <RegionPicker />
          <span className="text-xs text-text-muted hidden sm:inline">
            {user.firstName ?? user.emailAddresses[0]?.emailAddress}
          </span>
          <UserButton />
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 max-w-[1280px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
