import {forwardRef} from "react";
import {setWorkerUrl} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {AtlasVectorMap,type AtlasVectorMapProps} from "@atlas/react/vector";
import type {AtlasMapHandle} from "@atlas/react";
import "maplibre-gl/dist/maplibre-gl.css";

// Keep MapLibre and its browser-worker setup inside the lazy-loaded vector
// module. Raster-only sessions never download or initialize the WebGL engine.
setWorkerUrl(workerUrl);

const LazyVectorMap=forwardRef<AtlasMapHandle,AtlasVectorMapProps>(
  function LazyVectorMap(props,ref){
    return <AtlasVectorMap {...props} ref={ref}/>;
  }
);
export default LazyVectorMap;
