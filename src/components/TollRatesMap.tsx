"use client";

import { MapContainer, Marker, TileLayer, Popup } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import styles from "./toll-rates-map.module.css";
import type { TollRate, TollRateEndpoint } from "@/lib/wsdot";

type ApiSuccess = {
  updatedAt: string | null;
  rates: TollRate[];
};

type ApiError = {
  error: string;
};

type ApiResponse = ApiSuccess | ApiError;

const defaultCenter: LatLngExpression = [47.5, -122.2];
const ROUTE_EXPECTED_MAX: Record<string, number> = {
  "I-405": 10,
  "SR167": 9,
  "SR-167": 9,
  "SR99": 7,
};
const DEFAULT_EXPECTED_MAX = 10;

type TollSeverity = "free" | "standard" | "surge";

const toLatLng = (endpoint: TollRateEndpoint): LatLngExpression | null => {
  if (
    typeof endpoint.latitude === "number" &&
    typeof endpoint.longitude === "number"
  ) {
    return [endpoint.latitude, endpoint.longitude];
  }
  return null;
};

const formatCurrency = (value: number | null) => {
  if (value === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
};

const describeSegment = (rate: TollRate) => {
  const from = rate.start.name ?? "Unknown start";
  const to = rate.end.name ?? "Unknown end";
  return `${from} → ${to}`;
};

const useTollRates = () => {
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/toll-rates", { signal });
        const payload = (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(
            "error" in payload ? payload.error : "Unexpected error",
          );
        }

        if (!("rates" in payload)) {
          throw new Error("Malformed response from toll rates API");
        }

        setData(payload);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError((err as Error).message || "Unable to load toll rates");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    setSecondsRemaining(60);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const controller = new AbortController();
          void load(controller.signal);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [load]);

  return {
    rates: data?.rates ?? [],
    updatedAt: data?.updatedAt ?? null,
    loading,
    error,
    secondsRemaining,
  };
};

const buildRateKey = (rate: TollRate) =>
  [rate.id, rate.tripName, rate.travelDirection].filter(Boolean).join(":");

const sortRates = (rates: TollRate[]) =>
  [...rates].sort((a, b) => {
    const routeCompare = (a.stateRoute ?? "").localeCompare(
      b.stateRoute ?? "",
    );
    if (routeCompare !== 0) {
      return routeCompare;
    }
    return a.tripName.localeCompare(b.tripName);
  });

const normalizeRouteKey = (route: string | null) => {
  if (!route) {
    return null;
  }
  return route.replace(/[\s-]+/g, "").toUpperCase();
};

const expectedMaxForRate = (rate: TollRate) => {
  const key = normalizeRouteKey(rate.stateRoute);
  if (key && ROUTE_EXPECTED_MAX[key]) {
    return ROUTE_EXPECTED_MAX[key];
  }
  const tripNameUpper = rate.tripName.toUpperCase();
  if (tripNameUpper.includes("405")) {
    return ROUTE_EXPECTED_MAX["I-405"];
  }
  if (tripNameUpper.includes("167")) {
    return ROUTE_EXPECTED_MAX["SR167"];
  }
  return DEFAULT_EXPECTED_MAX;
};

const getTollSeverity = (rate: TollRate): TollSeverity => {
  const toll = rate.currentToll ?? 0;
  if (toll <= 0) {
    return "free";
  }
  const expectedMax = expectedMaxForRate(rate);
  return toll > expectedMax ? "surge" : "standard";
};

const markerPosition = (rate: TollRate): LatLngExpression | null =>
  toLatLng(rate.start) ?? toLatLng(rate.end);

const pinIconCache = new Map<TollSeverity, L.DivIcon>();

const getPinIcon = (severity: TollSeverity) => {
  if (!pinIconCache.has(severity)) {
    pinIconCache.set(
      severity,
      L.divIcon({
        className: "toll-pin-icon",
        html: `<span class="toll-pin toll-pin--${severity}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -9],
      }),
    );
  }
  return pinIconCache.get(severity)!;
};

type RateListItemProps = {
  rate: TollRate;
  onSelect?: () => void;
  canFocus: boolean;
};

const RateListItem = ({ rate, onSelect, canFocus }: RateListItemProps) => (
  <li className={styles.listItem}>
    <button
      type="button"
      className={styles.listItemButton}
      onClick={onSelect}
      disabled={!canFocus}
    >
      <h3>{rate.tripName}</h3>
      <div className={styles.rateValue}>{formatCurrency(rate.currentToll)}</div>
      <div className={styles.meta}>
        <span>
          {rate.stateRoute ? `${rate.stateRoute}` : "Route TBD"}
          {rate.travelDirection ? ` · ${rate.travelDirection}` : ""}
        </span>
        <span>{describeSegment(rate)}</span>
        <span>Updated: {formatTimestamp(rate.timeUpdated)}</span>
      </div>
      {rate.currentMessage && (
        <div className={styles.message}>{rate.currentMessage}</div>
      )}
    </button>
  </li>
);

const TollRatesMap = () => {
  const { rates, updatedAt, loading, error, secondsRemaining } = useTollRates();
  const [map, setMap] = useState<L.Map | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());

  const sortedRates = useMemo(() => sortRates(rates), [rates]);

  const markers = useMemo(
    () =>
      rates
        .map((rate) => ({
          rate,
          key: buildRateKey(rate),
          position: markerPosition(rate),
          severity: getTollSeverity(rate),
        }))
        .filter(
          (
            marker,
          ): marker is {
            rate: TollRate;
            key: string;
            position: LatLngExpression;
            severity: TollSeverity;
          } => Boolean(marker.position),
        ),
    [rates],
  );

  const positionsByKey = useMemo(() => {
    const entries = new Map<string, LatLngExpression>();
    markers.forEach(({ key, position }) => entries.set(key, position));
    return entries;
  }, [markers]);

  const highestRate = useMemo(() => {
    return sortedRates.reduce<TollRate | null>((current, rate) => {
      if (rate.currentToll === null) {
        return current;
      }
      if (!current || (current.currentToll ?? 0) < rate.currentToll) {
        return rate;
      }
      return current;
    }, null);
  }, [sortedRates]);

  const focusOnRate = useCallback(
    (rate: TollRate, key: string) => {
      const target = positionsByKey.get(key);
      if (map && target) {
        map.flyTo(target, Math.max(map.getZoom(), 11), {
          duration: 1.2,
        });
        markerRefs.current.get(key)?.openPopup();
      }
    },
    [map, positionsByKey],
  );

  const highestRateKey = highestRate ? buildRateKey(highestRate) : null;
  const highestRatePosition = highestRateKey
    ? positionsByKey.get(highestRateKey)
    : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.mapPanel}>
        <div className={styles.mapShell}>
          <MapContainer
            className={styles.mapContainer}
            center={defaultCenter}
            zoom={9}
            scrollWheelZoom
            whenCreated={setMap}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markers.map(({ rate, position, key, severity }) => (
              <Marker
                position={position}
                key={key}
                icon={getPinIcon(severity)}
                ref={(instance) => {
                  if (instance) {
                    markerRefs.current.set(key, instance);
                  } else {
                    markerRefs.current.delete(key);
                  }
                }}
              >
                <Popup>
                  <strong>{rate.tripName}</strong>
                  <br />
                  {formatCurrency(rate.currentToll)}
                  <br />
                  {describeSegment(rate)}
                  <br />
                  Updated: {formatTimestamp(rate.timeUpdated)}
                  {rate.currentMessage ? (
                    <>
                      <br />
                      {rate.currentMessage}
                    </>
                  ) : null}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
      <div className={styles.listPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Current Toll Rates</h2>
            <p className={styles.summary}>
              {updatedAt ? `Last updated ${formatTimestamp(updatedAt)}` : "Live data"}
            </p>
          </div>
          <span className={styles.autorefresh}>
            Refreshing in {secondsRemaining}s
          </span>
        </div>
        {highestRate && highestRateKey ? (
          <button
            type="button"
            className={styles.topRate}
            onClick={() => focusOnRate(highestRate, highestRateKey)}
            disabled={!highestRatePosition}
            aria-label="Focus map on most expensive segment"
          >
            <p className={styles.topLabel}>Most expensive right now</p>
            <div className={styles.topValue}>
              {formatCurrency(highestRate.currentToll)}
            </div>
            <p className={styles.topRoute}>{highestRate.tripName}</p>
            <p className={styles.topSegment}>{describeSegment(highestRate)}</p>
          </button>
        ) : null}
        {error && <div className={styles.error}>{error}</div>}
        {sortedRates.length > 0 ? (
          <ul className={styles.list}>
            {sortedRates.map((rate) => {
              const key = buildRateKey(rate);
              const position = positionsByKey.get(key);
              return (
                <RateListItem
                  rate={rate}
                  key={key}
                  canFocus={Boolean(position)}
                  onSelect={position ? () => focusOnRate(rate, key) : undefined}
                />
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyState}>
            {loading
              ? "Loading toll rates from WSDOT..."
              : "No toll rates available right now."}
          </p>
        )}
      </div>
    </div>
  );
};

export default TollRatesMap;
