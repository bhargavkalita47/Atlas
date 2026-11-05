import {safeHex,validPoint,type LatLng,type MarkerData,type Shape} from "./index";

type Coordinates=number[] | number[][] | number[][][];
export interface AtlasGeoJSONFeature{
  type:"Feature";
  geometry:{type:"Point"|"LineString"|"Polygon";coordinates:Coordinates};
  properties:Record<string,unknown>;
}
export interface AtlasGeoJSON{
  type:"FeatureCollection";
  features:AtlasGeoJSONFeature[];
}
export interface AtlasGeoJSONImport{
  markers:MarkerData[];
  shapes:Shape[];
  skipped:number;
}
export interface AtlasGeoJSONImportOptions {
  /** Generate IDs at import time to avoid colliding with existing application records. */
  idFactory?:(index:number)=>string;
  maxFeatures?:number;
  defaultColor?:string;
}
function pair(p:LatLng):[number,number]{return [p.lng,p.lat];}
function point(value:unknown):LatLng|null{
  if(!Array.isArray(value)||value.length<2)return null;
  const p={lat:value[1],lng:value[0]};
  return validPoint(p)?p:null;
}
function name(value:unknown,fallback:string):string{
  return typeof value==="string"?value.slice(0,120):fallback;
}
/**
 * Serialize Atlas markers and shapes to a GeoJSON FeatureCollection.
 * Circles are represented as Point features with Atlas radius metadata,
 * since GeoJSON has no standard circle geometry.
 */
export function toAtlasGeoJSON(markers:readonly MarkerData[],shapes:readonly Shape[]):AtlasGeoJSON{
  const features:AtlasGeoJSONFeature[]=[];
  for(const marker of markers){
    if(!validPoint(marker.point))continue;
    features.push({
      type:"Feature",
      geometry:{type:"Point",coordinates:pair(marker.point)},
      properties:{
        id:marker.id,name:marker.title,color:safeHex(marker.color),
        atlasKind:"marker"
      },
    });
  }
  for(const shape of shapes){
    const props:Record<string,unknown>={
      id:shape.id,name:shape.label??shape.kind,color:safeHex(shape.color),
      atlasKind:shape.kind,
    };
    if(shape.kind==="circle"){
      if(!validPoint(shape.center)||!Number.isFinite(shape.radiusMeters)||shape.radiusMeters<=0)continue;
      features.push({
        type:"Feature",
        geometry:{type:"Point",coordinates:pair(shape.center)},
        properties:{...props,radiusMeters:shape.radiusMeters},
      });
      continue;
    }
    const valid=shape.points.filter(validPoint);
    if(valid.length<(shape.kind==="polygon"?3:2))continue;
    const coords=valid.map(pair);
    features.push({
      type:"Feature",
      geometry:shape.kind==="polygon"
        ? {type:"Polygon",coordinates:[[...coords,coords[0]!]]}
        : {type:"LineString",coordinates:coords},
      properties:props,
    });
  }
  return {type:"FeatureCollection",features};
}
/**
 * Parse untrusted GeoJSON with bounded feature and vertex counts.
 * Returns normalized Atlas data, not raw user-provided feature objects.
 */
export function parseAtlasGeoJSON(raw:unknown,options:AtlasGeoJSONImportOptions={}):AtlasGeoJSONImport{
  if(!raw||typeof raw!=="object")throw new Error("Invalid GeoJSON document.");
  const collection=raw as {type?:unknown;features?:unknown};
  if(collection.type!=="FeatureCollection"||!Array.isArray(collection.features))
    throw new Error("Expected a GeoJSON FeatureCollection.");
  const maxFeatures=Math.min(1000,Math.max(1,Math.floor(options.maxFeatures??250)));
  const records=collection.features.slice(0,maxFeatures);
  const colors=safeHex(options.defaultColor);
  const markers:MarkerData[]=[],shapes:Shape[]=[];
  let skipped=collection.features.length-records.length;
  for(let index=0;index<records.length;index++){
    const record=records[index];
    if(!record||typeof record!=="object"){skipped++;continue;}
    const feature=record as {
      type?:unknown; geometry?:{type?:unknown;coordinates?:unknown};
      properties?:Record<string,unknown>
    };
    if(feature.type!=="Feature"||!feature.geometry){skipped++;continue;}
    const g=feature.geometry;
    const props=feature.properties??{};
    const id=options.idFactory?.(index)??"atlas-import-"+index;
    const title=name(props.name,"Imported feature");
    const color=safeHex(typeof props.color==="string"?props.color:undefined,colors);
    const kind=props.atlasKind??props.kind;
    if(g.type==="Point"){
      const p=point(g.coordinates);
      if(!p){skipped++;continue;}
      if(kind==="circle"&&typeof props.radiusMeters==="number"&&
         Number.isFinite(props.radiusMeters)&&props.radiusMeters>0&&props.radiusMeters<=100000){
        shapes.push({id,kind:"circle",center:p,color,label:title,radiusMeters:props.radiusMeters});
      }else{
        markers.push({id,point:p,color,title,draggable:true});
      }
      continue;
    }
    if(g.type==="LineString"||g.type==="Polygon"){
      const polygon=g.type==="Polygon";
      const value=polygon&&Array.isArray(g.coordinates)?g.coordinates[0]:g.coordinates;
      if(!Array.isArray(value)||value.length>1000){skipped++;continue;}
      let points=value.map(point);
      if(points.some(p=>p===null)){skipped++;continue;}
      let checked=points as LatLng[];
      // GeoJSON polygon rings close by repeating the first coordinate;
      // Atlas stores the unique vertices and closes the ring in rendering.
      if(polygon&&checked.length>1){
        const first=checked[0]!,last=checked[checked.length-1]!;
        if(first.lat===last.lat&&first.lng===last.lng)checked=checked.slice(0,-1);
      }
      if(checked.length<(polygon?3:2)){skipped++;continue;}
      shapes.push({id,kind:polygon?"polygon":"polyline",points:checked,color,label:title});
      continue;
    }
    skipped++;
  }
  return {markers,shapes,skipped};
}
