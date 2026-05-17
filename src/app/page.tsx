import styles from "./page.module.css";
import TollRatesMapSection from "@/components/TollRatesMapSection";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <p className={styles.tag}>WSDOT live data</p>
        <h1>Current express toll lane pricing</h1>
        <p>
          The dashboard below securely proxies the WSDOT Toll Rates API using the
          access key stored in your GitHub Actions secrets. Every refresh pulls
          the real-time Good To Go! rates for each corridor and projects them onto
          an interactive OpenStreetMap canvas.
        </p>
        <div className={styles.metaGrid}>
          <div>
            <span className={styles.metaLabel}>Data source</span>
            <strong>GetTollRatesAsJson</strong>
          </div>
          <div>
            <span className={styles.metaLabel}>Security</span>
            <strong>Key kept server-side</strong>
          </div>
          <div>
            <span className={styles.metaLabel}>Map</span>
            <strong>React Leaflet + OSM</strong>
          </div>
        </div>
      </section>
      <TollRatesMapSection />
    </main>
  );
}
