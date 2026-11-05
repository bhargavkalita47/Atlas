export interface LatLng { lat: number; lng: number }
export interface MapBounds { north: number; south: number; east: number; west: number }
export type Shape =
  | { id: string; kind: "polyline" | "polygon"; points: LatLng[]; color: string; label?: string }
  | { id: string; kind: "circle"; center: LatLng; radiusMeters: number; color: string; label?: string };
export interface MarkerData { id: string; point: LatLng; title: string; color?: string; draggable?: boolean; subtitle?: string }
export interface Place { id: string; name: string; point: LatLng; city?: string; locality?: string; country?: string }
export interface Geocoder {
  search(value: string): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
}
const rad = (deg: number) => deg * Math.PI / 180;
export function validPoint(p: unknown): p is LatLng {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return typeof x.lat === "number" && typeof x.lng === "number"
    && Number.isFinite(x.lat) && Number.isFinite(x.lng)
    && Math.abs(x.lat) <= 90 && Math.abs(x.lng) <= 180;
}
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const v = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
}
export function pathLengthKm(points: LatLng[]): number {
  let total=0;
  for(let i=1;i<points.length;i++)total+=haversineKm(points[i-1]!,points[i]!);
  return total;
}
export function formatDistance(km: number): string {
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(km < 10 ? 2 : 1) + " km";
}
export function parseCoordinatePair(value: string): LatLng | null {
  const raw = value.split(",");
  if (raw.length !== 2) return null;
  // Number("") and Number(" ") both yield zero; a partial pair must never
  // silently send a user to 0,0 or to an unintended location.
  const decimal = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/;
  if (!raw.every(part => decimal.test(part.trim()))) return null;
  const p = { lat: Number(raw[0]), lng: Number(raw[1]) };
  return validPoint(p) ? p : null;
}
export function inBounds(point: LatLng, bounds: MapBounds): boolean {
  if (point.lat > bounds.north || point.lat < bounds.south) return false;
  return bounds.west <= bounds.east
    ? point.lng >= bounds.west && point.lng <= bounds.east
    : point.lng >= bounds.west || point.lng <= bounds.east;
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch] ?? ch));
}
export function safeHex(value: string | undefined, fallback = "#5365da"): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

interface PhotonFeature {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: number[] };
}
const label = (v: unknown): string => typeof v === "string" ? v.trim() : "";
const first = (...items: unknown[]): string => items.map(label).find(Boolean) || "";
function fromPhoton(feature: PhotonFeature, index: number): Place | null {
  const p = feature.properties ?? {};
  const c = feature.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const point = {lat:c[1],lng:c[0]};
  if (!validPoint(point)) return null;
  const city = first(p.city,p.town,p.municipality,p.village,p.hamlet,p.county);
  const locality = first(p.suburb,p.neighbourhood,p.quarter,p.district,p.street);
  const name = first(p.name,locality,city,point.lat.toFixed(4) + ", " + point.lng.toFixed(4));
  const parts = Array.from(new Set([name, city, first(p.state), first(p.country)].filter(Boolean)));
  return {
    id: first(p.osm_type) + ":" + String(p.osm_id ?? index),
    name: parts.join(", "), point, city, locality, country:first(p.country)
  };
}
export interface PhotonOptions {
  baseUrl?: string;
  nominatimUrl?: string;
  fetcher?: typeof fetch;
  minGapMs?: number;
  timeoutMs?: number;
}
export function createPhotonGeocoder(options: PhotonOptions = {}): Geocoder {
  const base = (options.baseUrl ?? "https://photon.komoot.io").replace(/\/$/, "");
  const nominatim = (options.nominatimUrl ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  const request = options.fetcher ?? fetch;
  const waitMs = Math.max(0, options.minGapMs ?? 1100);
  const timeoutMs = Math.max(100, options.timeoutMs ?? 8000);
  const cache = new Map<string, Place[]>();
  let queue: Promise<void> = Promise.resolve();
  let last = 0;
  const paced = async <T>(job: () => Promise<T>): Promise<T> => {
    let release!: () => void;
    const pending = new Promise<void>(r => { release = r; });
    const previous = queue;
    queue = pending;
    await previous;
    try {
      const delay = Math.max(0, waitMs - (Date.now() - last));
      if (delay) await new Promise(r => setTimeout(r, delay));
      last = Date.now();
      return await job();
    } finally { release(); }
  };
  const json = async (url: string): Promise<unknown> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(url, {
        signal: controller.signal,
        headers: {Accept:"application/json"},
        referrerPolicy:"strict-origin-when-cross-origin"
      });
      if (!response.ok) throw new Error(response.status === 429 ? "Provider rate limited. Try again later." : "Place lookup unavailable.");
      return await response.json();
    } finally { clearTimeout(timeout); }
  };
  const photon = async (path: string, params: URLSearchParams): Promise<Place[]> => {
    const url = base + path + "?" + params;
    const existing = cache.get(url);
    if (existing) return existing;
    const payload = await paced(() => json(url)) as {features?:PhotonFeature[]};
    const result = (Array.isArray(payload.features) ? payload.features : [])
      .map(fromPhoton).filter((p):p is Place => p !== null).slice(0,8);
    cache.set(url, result);
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
    return result;
  };
  return {
    async search(raw: string) {
      const value = raw.trim();
      if (value.length < 3) throw new Error("Type at least 3 characters.");
      if (value.length > 140) throw new Error("Search is too long.");
      return photon("/api", new URLSearchParams({q:value,limit:"6"}));
    },
    async reverse(point: LatLng) {
      if (!validPoint(point)) throw new Error("Invalid coordinates.");
      let candidates: Place[] = [];
      try {
        candidates = await photon("/reverse", new URLSearchParams({
          lat:point.lat.toFixed(5),lon:point.lng.toFixed(5),limit:"8"
        }));
      } catch { /* Fallback below. */ }
      const nearest = candidates[0];
      const city = candidates.map(p => p.city).find(Boolean);
      const locality = candidates.map(p => p.locality).find(Boolean);
      if (nearest && city && locality) return {...nearest,point,city,locality};
      try {
        const u = nominatim + "/reverse?" + new URLSearchParams({
          format:"jsonv2",lat:point.lat.toFixed(5),lon:point.lng.toFixed(5),
          zoom:"18",addressdetails:"1","accept-language":"en"
        });
        const result = await paced(() => json(u)) as {address?:Record<string,unknown>;display_name?:string};
        const addr = result.address ?? {};
        const fallbackCity = first(addr.city,addr.town,addr.municipality,addr.village,addr.county);
        const fallbackLocality = first(addr.suburb,addr.neighbourhood,addr.quarter,addr.city_district,addr.road);
        return {
          id:nearest?.id ?? "nominatim:reverse",
          point,
          name:first(result.display_name,nearest?.name,fallbackCity,"Unknown location"),
          city:first(fallbackCity,city),
          locality:first(fallbackLocality,locality),
          country:first(addr.country,nearest?.country)
        };
      } catch {
        return nearest ? {...nearest,point,city:first(city),locality:first(locality)} : null;
      }
    }
  };
}

export {toAtlasGeoJSON,parseAtlasGeoJSON} from "./geojson";
