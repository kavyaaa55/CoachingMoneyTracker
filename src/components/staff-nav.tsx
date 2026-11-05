"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { links: { href: string; label: string }[] };

export function StaffNav({ links }: Props) {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex flex-wrap gap-2 md:flex-col md:flex-nowrap md:gap-1">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`block min-h-12 flex-1 rounded-sm px-3 py-3 whitespace-nowrap md:flex-none ${
              active ? "bg-highlight font-medium" : "text-muted hover:bg-highlight"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
