"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderSearch() {
  const pathname = usePathname();

  // Hide when already on search page
  if (pathname === "/search") return null;

  return (
    <>
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
    </>
  );
}
