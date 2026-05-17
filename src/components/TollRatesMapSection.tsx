"use client";

import dynamic from "next/dynamic";
import styles from "./toll-rates-map-section.module.css";

const TollRatesMap = dynamic(() => import("./TollRatesMap"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading interactive map…</p>,
});

const TollRatesMapSection = () => <TollRatesMap />;

export default TollRatesMapSection;
