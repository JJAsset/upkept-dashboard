import type { ReactNode } from "react";
import styles from "./RankedTable.module.css";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
}

export default function RankedTable<T>({
  columns,
  rows,
  emptyMessage,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
}) {
  if (!rows.length) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col" className={styles.rankHead}>
            #
          </th>
          {columns.map((c) => (
            <th key={c.key} scope="col" style={{ textAlign: c.align ?? "left" }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td className={styles.rankCell}>
              <span className={styles.rankBadge}>{i + 1}</span>
            </td>
            {columns.map((c) => (
              <td key={c.key} style={{ textAlign: c.align ?? "left" }}>
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
