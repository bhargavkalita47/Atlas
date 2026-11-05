import {forwardRef} from "react";
import {AtlasMap,MarkerLayer,ShapeLayer,type AtlasMapHandle,type AtlasMapProps} from "@atlas/react";
import type {LatLng,MarkerData,Shape} from "@atlas/core";
import "leaflet/dist/leaflet.css";

export interface AtlasRasterMapProps extends Omit<AtlasMapProps,"children"> {
  markers:readonly MarkerData[];
  shapes:readonly Shape[];
  selectedId?:string|null;
  onSelect?:(id:string)=>void;
  onDrag?:(id:string,point:LatLng)=>void;
}

/**
 * The fallback is a separate lazy chunk: vector-first sessions never download
 * Leaflet, and raster-only sessions never download MapLibre.
 */
const LazyRasterMap=forwardRef<AtlasMapHandle,AtlasRasterMapProps>(
  function LazyRasterMap({
    markers,shapes,selectedId,onSelect,onDrag,...mapProps
  },ref){
    return <AtlasMap {...mapProps} ref={ref}>
      <MarkerLayer markers={markers} selectedId={selectedId} onSelect={onSelect} onDrag={onDrag}/>
      <ShapeLayer shapes={shapes}/>
    </AtlasMap>;
  }
);
export default LazyRasterMap;
