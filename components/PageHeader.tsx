import { RefreshCw } from "lucide-react";
import styles from "./PageHeader.module.css";

export default function PageHeader({
  title,
  subtitle,
  loading,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.heading}>{title}</h1>
        <p className={styles.subhead}>{subtitle}</p>
      </div>
      <button className={styles.refresh} onClick={onRefresh} disabled={loading} aria-label="Refresh metrics">
        <RefreshCw size={16} aria-hidden="true" className={loading ? styles.spin : undefined} />
        Refresh
      </button>
    </header>
  );
}
