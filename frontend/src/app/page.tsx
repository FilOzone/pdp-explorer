import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>PDP Explorer</h1>
        <p className={styles.description}>
          Explore the PDP hot storage network
        </p>
      </main>
    </div>
  );
}
