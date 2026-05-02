const SERVER_URL =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "";
const CLIENT_URL = "/api/proxy";

const CLIENT_CACHE_TTL_MS = 15_000;

const clientCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();


interface FetchOptions {
  params?: Record<string, string | number | undefined>;
  revalidate?: number;
}

function buildUrl(base: string, endpoint: string, params?: Record<string, string | number | undefined>): string {
  let url = `${base}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "all") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

/** Server-side fetch (SSR / ISR) — uses direct backend URL */
async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, revalidate = 60 } = options;
  const url = buildUrl(SERVER_URL, endpoint, params);

  const res = await fetch(url, {
    next: { revalidate },
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

/** Client-side fetch — uses proxy to avoid mixed content */
interface ClientFetchOptions {
  params?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function isClientFetchOptions(value: unknown): value is ClientFetchOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    ("params" in value || "signal" in value)
  );
}

export async function clientFetch<T>(
  endpoint: string,
  paramsOrOptions?: Record<string, string | number | undefined> | ClientFetchOptions
): Promise<T> {
  const base = typeof window !== "undefined" ? CLIENT_URL : SERVER_URL;

  const params: Record<string, string | number | undefined> | undefined =
    isClientFetchOptions(paramsOrOptions) ? paramsOrOptions.params : paramsOrOptions;

  const signal: AbortSignal | undefined =
    isClientFetchOptions(paramsOrOptions) ? paramsOrOptions.signal : undefined;

  const url = buildUrl(base, endpoint, params);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const cacheKey = url;
  const now = Date.now();

  if (typeof window !== "undefined") {
    const cached = clientCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.promise as Promise<T>;
    }
  }

  const requestPromise = fetch(url, { signal: controller.signal }).then(async (res) => {
    if (!res.ok) throw new Error(`API Error: ${res.status} for ${url}`);
    return res.json() as Promise<T>;
  });

  if (typeof window !== "undefined") {
    clientCache.set(cacheKey, {
      expiresAt: now + CLIENT_CACHE_TTL_MS,
      promise: requestPromise,
    });
  }

  try {
    return await requestPromise;
  } finally {
    clearTimeout(timeout);
  }
}

export async function clientPost<T>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const base = typeof window !== "undefined" ? CLIENT_URL : SERVER_URL;
  const url = buildUrl(base, endpoint);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`API Error: ${res.status} for ${url}`);
  return res.json();
}

// ---------- Overview ----------
export async function getSystemOverview(mode?: string) {
  return apiFetch<any>("/overview/system", { params: mode ? { mode } : undefined });
}
export async function getDashboardSnapshot() {
  return apiFetch<any>("/overview/dashboard-snapshot", { revalidate: 60 });
}
export async function getRouteRanking(params?: { mode?: string; limit?: number }) {
  return apiFetch<any>("/overview/route-ranking", { params: params as any });
}
export async function getTripsByMode() {
  return apiFetch<any>("/overview/trips-by-mode");
}
export async function getPerformanceTrends(params?: { day_type?: string }) {
  return apiFetch<any>("/overview/performance-trends", { params: params as any });
}
export async function getReliabilityTrend(params?: { period?: string; granularity?: string }) {
  return apiFetch<any>("/overview/reliability-trend", { params: params as any });
}

// ---------- Alerts ----------
export async function getActiveAlerts(params?: { severity?: string; limit?: number }) {
  return apiFetch<any>("/alerts/active", { params: params as any });
}
export async function getAlertsByMode() {
  return apiFetch<any>("/alerts/by-mode");
}
export async function getAlertSummary() {
  return apiFetch<any>("/alerts/summary");
}

// ---------- Routes ----------
export async function getRouteReliability(params?: { period_days?: number }) {
  return apiFetch<any>("/routes/reliability", { params: params as any });
}
export async function getRouteDetails(routeId: string) {
  return apiFetch<any>(`/routes/${routeId}/details`);
}
export async function getRouteHourly(routeId: string) {
  return apiFetch<any>(`/routes/${routeId}/hourly`);
}

// ---------- Delays ----------
export async function getDelayHeatmap(params?: { route_id?: string; period_days?: number; direction_id?: number }) {
  return apiFetch<any>("/delays/heatmap", { params: params as any });
}
export async function getDayOfWeekStats(params?: { route_id?: string; period_days?: number }) {
  return apiFetch<any>("/delays/temporal/day-of-week", { params: params as any });
}
export async function getHourlyStats(params?: { route_id?: string; period_days?: number }) {
  return apiFetch<any>("/delays/temporal/hourly", { params: params as any });
}
export async function getRushHourComparison(params?: { route_id?: string; period_days?: number }) {
  return apiFetch<any>("/delays/temporal/rush-hour-comparison", { params: params as any });
}
export async function getDelayProbability(params?: { route_id?: string; period_days?: number }) {
  return apiFetch<any>("/delays/temporal/delay-probability", { params: params as any });
}

// ---------- Stations ----------
export async function getStationPerformance(params?: { sort_by?: string; limit?: number }) {
  return apiFetch<any>("/stations/performance", { params: params as any });
}
export async function getStationMap() {
  return apiFetch<any>("/stations/map");
}
export async function getSystemMapData() {
  return apiFetch<any>("/stations/map/system", { revalidate: 300 });
}
export async function getDelayHotspots(params?: { limit?: number }) {
  return apiFetch<any>("/stations/delay-hotspots", { params: params as any });
}
export async function getStationDetails(stopId: string) {
  return apiFetch<any>(`/stations/${stopId}/details`);
}

// ---------- Weather ----------
export async function getWeatherOverview(params?: { route_id?: string }) {
  return apiFetch<any>("/weather/overview", { params: params as any });
}
export async function getTemperatureScatter(params?: { route_id?: string }) {
  return apiFetch<any>("/weather/scatter/temperature", { params: params as any });
}
export async function getCurrentWeather() {
  return apiFetch<any>("/weather/current");
}
export async function getWeatherDelayImpact() {
  return apiFetch<any>("/weather/delay-impact");
}
export async function getWindScatter(params?: { route_id?: string }) {
  return apiFetch<any>("/weather/scatter/wind", { params: params as any });
}
export async function getRouteVulnerability() {
  return apiFetch<any>("/weather/route-vulnerability");
}

// ---------- Quality ----------
export async function getQualityOverview() {
  return apiFetch<any>("/quality/overview");
}
export async function getQualityAlerts(params?: { severity?: string; limit?: number }) {
  return apiFetch<any>("/quality/alerts", { params: params as any });
}

// ---------- Schedules ----------
export async function getScheduleRoutes() {
  return apiFetch<any>("/schedules/routes");
}
export async function getScheduleTimetable(routeId: string, directionId: number = 0) {
  return apiFetch<any>("/schedules/timetable", { params: { route_id: routeId, direction_id: directionId } });
}
export async function getStopDepartures(stopId: string) {
  return apiFetch<any>("/schedules/stop", { params: { stop_id: stopId } });
}

// ---------- Trip Planner ----------
export async function searchStops(query: string) {
  return apiFetch<any>("/trip/search-stops", { params: { q: query } });
}
export async function findRoutes(origin: string, destination: string) {
  return apiFetch<any>("/trip/find-routes", { params: { origin, destination } });
}
