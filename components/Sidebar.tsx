import { LayoutDashboard } from "lucide-react";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Primary">
      <div className={styles.brand}>
        {/* Odevo wordmark, inverted to white for the dark identity surface */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/odevo-logo-with-wordmark.svg" alt="Odevo" className={styles.logo} />
      </div>

      <nav className={styles.nav} aria-label="Main">
        <a href="/" className={`${styles.navItem} ${styles.active}`} aria-current="page">
          <LayoutDashboard size={18} aria-hidden="true" />
          <span>Dashboard</span>
        </a>
      </nav>

      <p className={styles.footer}>Upkept · Production</p>
    </aside>
  );
}
