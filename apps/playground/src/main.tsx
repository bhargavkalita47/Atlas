import React from "react";
import {createRoot} from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import {setWorkerUrl} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "./styles.css";
import App from "./App";

// MapLibre v6 loads a separate ES module worker. Vite must bundle the worker
// and its imports, then register the resulting same-origin URL before
// AtlasVectorMap initializes. This requires no third-party API key.
setWorkerUrl(maplibreWorkerUrl);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App/></React.StrictMode>
);
