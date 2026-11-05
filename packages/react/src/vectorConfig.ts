export type VectorTheme = {
  land: string;
  water: string;
  parks: string;
  roads: string;
  buildings: string;
  labels: string;
};

export const DEFAULT_VECTOR_THEME: VectorTheme = {
  land: "#f2f2ed",
  water: "#b9dbe9",
  parks: "#c8dfc1",
  roads: "#ffffff",
  buildings: "#deddea",
  labels: "#364555",
};

export const KEYLESS_VECTOR_STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export interface VectorPerformanceEvent {
  phase: "style" | "idle";
  elapsedMs: number;
  styleUrl: string;
}

/**
 * Hint that a style JSON document is likely to be needed soon. This only
 * preloads a single style URL; it never downloads geographic tiles.
 *
 * An idempotent, browser-only resource hint: repeat calls and SSR are safe.
 * The browser remains responsible for using the provider's HTTP cache rules.
 */
export function preloadVectorStyle(styleUrl:string,priority:"high"|"low"="low"):boolean{
  if(typeof document==="undefined")return false;
  let url:URL;
  try{
    url=new URL(styleUrl,document.baseURI);
  }catch{return false;}
  if(url.protocol!=="https:"&&url.origin!==document.location.origin)return false;
  const existing=document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="fetch"]');
  for(const item of existing){
    if(item.href===url.href)return false;
  }
  const hint=document.createElement("link");
  hint.rel="preload";
  hint.as="fetch";
  hint.href=url.href;
  hint.crossOrigin="anonymous";
  hint.setAttribute("fetchpriority",priority);
  document.head.appendChild(hint);
  return true;
}
