import { UserButton } from "@clerk/nextjs";
import { NavLinks } from "@/components/nav-links";
import Link from "next/link";
import { RegionPicker } from "@/components/region-selector";
import { MobileNav } from "@/components/mobile-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-3">
          {/* Desktop: logo left + nav */}
          <Link href="/" className="hidden sm:block flex-none">
            <img src="/logo.svg" alt="MyTCG" className="h-7" />
          </Link>
          <span className="hidden sm:contents"><NavLinks /></span>
          <div className="hidden sm:block flex-1" />

          {/* Mobile: logo centered */}
          <div className="sm:hidden flex-1 flex justify-center">
            <Link href="/">
              <img src="/logo.svg" alt="MyTCG" className="h-8" style={{ filter: "brightness(0) saturate(100%) invert(14%) sepia(95%) saturate(5765%) hue-rotate(355deg) brightness(87%) contrast(96%)" }} />
            </Link>
          </div>

          {/* Desktop search */}
          <Link
            href="/search"
            className="hidden sm:flex items-center gap-2 bg-white rounded-full px-4 py-2 text-text-dim text-sm hover:shadow-md hover:text-text-muted transition-all min-w-[180px] shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search cards
          </Link>

          <span className="hidden sm:block"><RegionPicker /></span>
          <Link
            href="/settings"
            className="hidden sm:block p-1.5 rounded-lg text-text-dim hover:text-text active:opacity-70 transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </Link>
          <span className="hidden sm:block"><UserButton /></span>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-24 sm:pb-16 max-w-[1280px] mx-auto w-full page-enter">
        {children}
      </main>

      <MobileNav />
    </div>
  );
}
