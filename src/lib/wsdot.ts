const API_BASE = "https://www.wsdot.wa.gov/Traffic/api/TollRates/TollRatesREST.svc";

export type RawTollRate = {
  CurrentMessage?: string | null;
  CurrentToll?: number | string | null;
  EndLatitude?: number | string | null;
  EndLocationName?: string | null;
  EndLongitude?: number | string | null;
  EndMilepost?: number | string | null;
  StartLatitude?: number | string | null;
  StartLocationName?: string | null;
  StartLongitude?: number | string | null;
  StartMilepost?: number | string | null;
  StateRoute?: string | null;
  TimeUpdated?: string | null;
  TravelDirection?: string | null;
  TripName?: string | null;
};

export type TollRateEndpoint = {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  milepost: number | null;
};

export type TollRate = {
  id: string;
  tripName: string;
  stateRoute: string | null;
  travelDirection: string | null;
  start: TollRateEndpoint;
  end: TollRateEndpoint;
  currentToll: number | null;
  currentMessage: string | null;
  timeUpdated: string | null;
};

export type TollRatePayload = {
  updatedAt: string | null;
  rates: TollRate[];
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeEndpoint = (
  locationName: string | null | undefined,
  latitude: unknown,
  longitude: unknown,
  milepost: unknown,
): TollRateEndpoint => ({
  name: locationName?.trim() || null,
  latitude: parseNumber(latitude),
  longitude: parseNumber(longitude),
  milepost: parseNumber(milepost),
});

const normalizeTollValue = (value: number | null) => {
  if (value === null) {
    return null;
  }
  if (value > 50) {
    return value / 100;
  }
  return value;
};

const normalizeRate = (raw: RawTollRate, index: number): TollRate => {
  const start = normalizeEndpoint(
    raw.StartLocationName,
    raw.StartLatitude,
    raw.StartLongitude,
    raw.StartMilepost,
  );
  const end = normalizeEndpoint(
    raw.EndLocationName,
    raw.EndLatitude,
    raw.EndLongitude,
    raw.EndMilepost,
  );

  let timeUpdated: string | null = null;
  if (raw.TimeUpdated) {
    const date = new Date(raw.TimeUpdated);
    if (!Number.isNaN(date.getTime())) {
      timeUpdated = date.toISOString();
    }
  }

  const tripSegment = [raw.TripName, raw.TravelDirection, raw.StateRoute]
    .filter(Boolean)
    .map((value) => value!.trim())
    .join("-");

  return {
    id: tripSegment || `rate-${index}`,
    tripName: buildFriendlyTripName(raw, start, end),
    stateRoute: raw.StateRoute?.trim() || null,
    travelDirection: raw.TravelDirection?.trim() || null,
    start,
    end,
    currentToll: normalizeTollValue(parseNumber(raw.CurrentToll)),
    currentMessage: raw.CurrentMessage?.trim() || null,
    timeUpdated,
  };
};

const TRIP_CODE_PATTERN = /^\d{3}tp\d{5}$/i;

const buildFriendlyTripName = (
  raw: RawTollRate,
  start: TollRateEndpoint,
  end: TollRateEndpoint,
) => {
  const rawName = raw.TripName?.trim();
  if (rawName && !TRIP_CODE_PATTERN.test(rawName)) {
    return rawName;
  }
  if (end.name) {
    return end.name;
  }
  if (start.name) {
    return start.name;
  }
  return rawName || "Unknown trip";
};

export async function fetchTollRates(
  accessCode: string,
  requestInit?: RequestInit,
): Promise<TollRatePayload> {
  if (!accessCode) {
    throw new Error("Missing WSDOT API access code");
  }

  const endpoint = new URL(`${API_BASE}/GetTollRatesAsJson`);
  endpoint.searchParams.set("AccessCode", accessCode);

  const response = await fetch(endpoint, {
    ...(requestInit || {}),
    headers: {
      Accept: "application/json",
      ...(requestInit?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WSDOT API request failed (${response.status})`);
  }

  const rawPayload = (await response.json()) as RawTollRate[];
  const rates = rawPayload.map(normalizeRate);
  const updatedAt = rates.reduce<string | null>((latest, rate) => {
    if (!rate.timeUpdated) {
      return latest;
    }
    if (!latest) {
      return rate.timeUpdated;
    }
    return Date.parse(rate.timeUpdated) > Date.parse(latest)
      ? rate.timeUpdated
      : latest;
  }, null);

  return { updatedAt, rates };
}
