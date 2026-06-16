"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: Array<{ href: string; label: string; mobileLabel: string | null; icon: React.ReactNode }> = [
  { href: "/", label: "Collections", mobileLabel: "Collections", icon: null },
  { href: "/browse", label: "Browse", mobileLabel: null, icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  )},
  { href: "/watch", label: "Screen Watch", mobileLabel: null, icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )},
  { href: "/intel", label: "What's Happening", mobileLabel: null, icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )},
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-2.5 sm:py-1.5 rounded-lg text-sm font-medium transition-colors active:opacity-70 ${
              isActive
                ? "bg-bg-surface text-text"
                : "text-text-muted hover:text-text"
            }`}
            title={link.label}
          >
            {link.icon ? (
              <>
                <span className="sm:hidden">{link.icon}</span>
                <span className="hidden sm:inline-flex items-center gap-1.5">
                  {link.icon}
                  <span>{link.label}</span>
                </span>
              </>
            ) : (
              link.mobileLabel ?? link.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
