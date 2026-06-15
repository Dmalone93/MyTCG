"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Collections" },
  { href: "/search", label: "Search" },
  { href: "/intel", label: "Intel" },
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
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
