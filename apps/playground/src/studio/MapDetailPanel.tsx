import {useMemo} from "react";
import {
  ROAD_TIERS,DETAIL_FEATURES,createMapDetailSettings,classifyRoadLayer,
  type RoadTier,type DetailFeature,type DetailDensity,type MapDetailSettings,
  type StyleLayerDescriptor
} from "@atlas/style-core";
import {RotateCcw,SlidersHorizontal} from "lucide-react";

type Props={
  layers:readonly StyleLayerDescriptor[];
  settings:MapDetailSettings;
  presetSettings:MapDetailSettings;
  presetName:string;
  onChange:(next:MapDetailSettings)=>void;
  onReset:()=>void;
};
const tiers:Record<RoadTier,{name:string;examples:string}>={
  motorway:{name:"Motorways & highways",examples:"Motorway, trunk and expressway"},
  primary:{name:"Primary roads",examples:"Main city arteries"},
  secondary:{name:"Secondary roads",examples:"Secondary and tertiary connections"},
  local:{name:"Residential & local roads",examples:"Minor roads and neighbourhood streets"},
  paths:{name:"Service roads & paths",examples:"Service, walking, cycling and tracks"}
};
const features:Record<DetailFeature,{name:string;note:string}>={
  buildings:{name:"Buildings",note:"Building footprints and 3D extrusions"},
  water:{name:"Water bodies",note:"Lakes, rivers and waterways"},
  parks:{name:"Parks & vegetation",note:"Forest, parks and green spaces"},
  placeLabels:{name:"Place names",note:"Cities, places and geographic labels"},
  roadLabels:{name:"Road names",note:"Street and highway labels"},
  poi:{name:"Points of interest",note:"Shops, amenities and POI symbols"},
  transit:{name:"Transit & rail",note:"Rail, metro and transit lines"},
  boundaries:{name:"Administrative boundaries",note:"Borders and district lines"},
  terrain:{name:"Terrain",note:"Hillshade and elevation layers"}
};
const densityNames:readonly {id:DetailDensity;name:string}[]=[
  {id:"full",name:"Full"},{id:"balanced",name:"Balanced"},
  {id:"quiet",name:"Quiet"},{id:"essential",name:"Essential"}
];
const matchDensity=(value:MapDetailSettings):DetailDensity|null=>{
  const key=JSON.stringify(value);
  return densityNames.find(item=>JSON.stringify(createMapDetailSettings(item.id))===key)?.id??null;
};
export function MapDetailPanel({layers,settings,presetSettings,presetName,onChange,onReset}:Props){
  const density=matchDensity(settings);
  const coverage=useMemo(()=>{
    const roads=layers.filter(l=>l.suggestedGroup==="roads"&&l.type==="line");
    const mixed=roads.filter(l=>classifyRoadLayer(l)===null).length;
    const classified=Object.fromEntries(ROAD_TIERS.map(t=>[t,roads.filter(l=>classifyRoadLayer(l)===t).length])) as Record<RoadTier,number>;
    return {roads:roads.length,mixed,classified};
  },[layers]);
  const setRoad=(key:RoadTier,value:number)=>
    onChange({...settings,roads:{...settings.roads,[key]:value}});
  const setFeature=(key:DetailFeature,update:Partial<MapDetailSettings["features"][DetailFeature]>)=>
    onChange({...settings,features:{...settings.features,
      [key]:{...settings.features[key],...update}}});
  return <section className="pane-section atlas-detail-panel" aria-label="Map detail controls">
    <div className="section-heading">
      <div className="section-label"><SlidersHorizontal size={13}/> MAP DETAIL CONTROLS</div>
      <button type="button" className="quiet-button atlas-detail-reset"
        onClick={onReset}><RotateCcw size={13}/> Reset to preset</button>
    </div>
    <p className="atlas-detail-intro">Each preset now has its own road hierarchy and detail design. Adjust anything below without reloading the map.</p>
    <div className="atlas-detail-profile" role="status">
      <span>Preset detail design</span>
      <strong>{presetName}</strong>
      {JSON.stringify(settings)===JSON.stringify(presetSettings)?" · original":" · customized"}
    </div>
    <div className="atlas-density-options" role="group" aria-label="Map detail density">
      {densityNames.map(item=><button type="button" key={item.id}
        aria-pressed={density===item.id}
        onClick={()=>onChange(createMapDetailSettings(item.id))}>{item.name}</button>)}
    </div>
    <div className="atlas-detail-subtitle">
      <span>ROAD HIERARCHY</span><small>{coverage.roads} road layers</small>
    </div>
    {ROAD_TIERS.map(tier=><div className="atlas-detail-row" key={tier}>
      <div className="atlas-detail-top">
        <span><strong className="atlas-detail-label">{tiers[tier].name}</strong>
          <small className="atlas-detail-subline">{tiers[tier].examples}</small></span>
        <span className="atlas-detail-value">{settings.roads[tier]}%</span>
      </div>
      <input className="atlas-detail-slider" type="range"
        aria-label={tiers[tier].name+" opacity"} min="0" max="100" step="1"
        value={settings.roads[tier]} onChange={e=>setRoad(tier,Number(e.target.value))}/>
      <span className="atlas-detail-subline">
        {coverage.classified[tier]?"Separate layers: "+coverage.classified[tier]:
          coverage.mixed?"Uses road feature classifications":"No matching layers detected"}
      </span>
    </div>)}
    <div className="atlas-detail-subtitle"><span>MAP FEATURES</span><small>Visibility and opacity</small></div>
    {DETAIL_FEATURES.map(key=><div className="atlas-detail-row" key={key}>
      <div className="atlas-detail-top">
        <span><strong className="atlas-detail-label">{features[key].name}</strong>
          <small className="atlas-detail-subline">{features[key].note}</small></span>
        <select className="atlas-detail-visibility" aria-label={features[key].name+" visibility"}
          value={settings.features[key].visible===null?"inherit":settings.features[key].visible?"show":"hide"}
          onChange={event=>setFeature(key,{
            visible:event.target.value==="inherit"?null:event.target.value==="show"
          })}>
          <option value="inherit">Preset</option>
          <option value="show">Show</option>
          <option value="hide">Hide</option>
        </select>
      </div>
      <div className="atlas-detail-top">
        <input className="atlas-detail-slider" type="range"
          aria-label={features[key].name+" opacity"}
          min="0" max="100" step="5" disabled={settings.features[key].visible===false}
          value={settings.features[key].opacity}
          onChange={event=>setFeature(key,{opacity:Number(event.target.value)})}/>
        <span className="atlas-detail-value">{settings.features[key].opacity}%</span>
      </div>
    </div>)}
    <p className="atlas-detail-footnote">
      Road classes depend on the tile provider. Atlas targets specifically named road layers when available,
      and uses per-feature road classes in shared layers. Features not present in this base style cannot be shown.
      Your manual changes carry over when switching presets; unedited controls follow the next preset.
    </p>
  </section>;
}
