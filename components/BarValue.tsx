import styles from "./BarValue.module.css";

export default function BarValue({ value, max }: { value: number; max: number }) {
  return (
    <span className={styles.barWrap}>
      <span className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${(value / Math.max(1, max)) * 100}%` }} />
      </span>
      <span className={styles.barValue}>{value}</span>
    </span>
  );
}
