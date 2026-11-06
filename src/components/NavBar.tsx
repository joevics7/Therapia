"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/groups", label: "Groups", icon: "◎" },
  { href: "/therapy", label: "Therapy", icon: "✉" },
  { href: "/library", label: "Library", icon: "❏" },
  { href: "/tools", label: "Tools", icon: "✦" },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-in">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
            <span className="nv" aria-hidden="true">{n.icon}</span>{n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
