"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Users } from "lucide-react";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/", label: "Asset information", Icon: Boxes },
  { href: "/team", label: "Team performance", Icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Primary">
      <div className={styles.brand}>
        {/* Odevo wordmark, inverted to white for the dark identity surface */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/odevo-logo-with-wordmark.svg" alt="Odevo" className={styles.logo} />
      </div>

      <nav className={styles.nav} aria-label="Main">
        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <p className={styles.footer}>Upkept · Production</p>
    </aside>
  );
}
