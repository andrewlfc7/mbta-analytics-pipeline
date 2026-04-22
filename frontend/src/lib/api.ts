const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://34.30.107.174:8000/api/v1";

interface FetchOptions {
  params?: Record<string, string | number | undefined>;
  revalidate?: number;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, revalidate = 60 } = options;

  let url = `${API_BASE}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "all") {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const res = await fetch(url, {
    next: { revalidate },
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText} for ${url}`);
  }

  return res.json();
}

// ---------- Overview ----------
export async function getSystemOverview() {
  return apiFetch<any>("/overview/system");
}

export async function getRouteRanking() {
  return apiFetch<any>("/overview/route-ranking");
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
export async function getDelayHeatmap(params?: {
  route_id?: string;
  period_days?: number;
  direction_id?: number;
}) {
  return apiFetch<any>("/delays/heatmap", { params: params as any });
}

export async function getDayOfWeekStats(params?: {
  route_id?: string;
  period_days?: number;
}) {
  return apiFetch<any>("/delays/temporal/day-of-week", { params: params as any });
}

export async function getHourlyStats(params?: {
  route_id?: string;
  period_days?: number;
}) {
  return apiFetch<any>("/delays/temporal/hourly", { params: params as any });
}

export async function getRushHourComparison(params?: {
  route_id?: string;
  period_days?: number;
}) {
  return apiFetch<any>("/delays/temporal/rush-hour-comparison", { params: params as any });
}

export async function getDelayProbability(params?: {
  route_id?: string;
  period_days?: number;
}) {
  return apiFetch<any>("/delays/temporal/delay-probability", { params: params as any });
}

// ---------- Stations ----------
export async function getStationPerformance(params?: {
  sort_by?: string;
  limit?: number;
}) {
  return apiFetch<any>("/stations/performance", { params: params as any });
}

export async function getStationMap() {
  return apiFetch<any>("/stations/map");
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