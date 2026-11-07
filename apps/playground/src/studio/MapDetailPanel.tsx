import {useMemo} from "react";
import {
  ROAD_TIERS,ROAD_CONTROL_GROUPS,ROAD_GROUP_TIERS,DETAIL_FEATURES,createMapDetailSettings,classifyRoadLayer,
  type RoadTier,type RoadControlGroup,type DetailFeature,type DetailDensity,type MapDetailSettings,
  type StyleLayerDescriptor
} from "@atlas/style-core";
import {RotateCcw,SlidersHorizontal} from "lucide-react";

type Props={
  layers:readonly StyleLayerDescriptor[];
  settings:MapDetailSettings;
  presetSettings:MapDetailSettings;
  presetName:string;
  baseStyle?:unknown;
  onChange:(next:MapDetailSettings)=>void;
  onReset:()=>void;
};
const tiers:Record<RoadTier,{name:string;examples:string}>={
  motorway:{name:"Motorways & highways",examples:"Motorway, trunk and expressway · Primary Roads"},
  primary:{name:"Arterial roads (Primary)",examples:"Main city routes and OSM primary/secondary"},
  secondary:{name:"Tertiary connectors (Secondary)",examples:"Tertiary and collector roads"},
  local:{name:"Neighbourhood roads (Secondary)",examples:"Residential, minor, service, track and bylanes"},
  paths:{name:"Walking and cycling paths",examples:"Footpaths and trails, independent of driving roads"}
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
const groupNames:Record<RoadControlGroup,{name:string;description:string}>={
  primaryRoads:{name:"Primary Roads",description:"Motorways, highways and main arterial city roads"},
  secondaryRoads:{name:"Secondary Roads",description:"Residential streets, connecting lanes, service roads and bylanes"},
  paths:{name:"Footpaths & Cycleways",description:"Non-driving paths, independently adjustable"}
};
export function MapDetailPanel({layers,settings,presetSettings,presetName,baseStyle,onChange,onReset}:Props){
  const density=matchDensity(settings);
  const coverage=useMemo(()=>{
    const roads=layers.filter(l=>l.suggestedGroup==="roads"&&l.type==="line");
    const raw=(baseStyle&&typeof baseStyle==="object"&&"layers" in baseStyle)
      ?(baseStyle as {layers?:unknown}).layers:null;
    const original=new Map<string,Record<string,unknown>>(
      (Array.isArray(raw)?raw:[])
        .filter((x):x is Record<string,unknown>=>x!==null&&typeof x==="object"&&typeof x.id==="string")
        .map(x=>[x.id as string,x])
    );
    const classified=Object.fromEntries(ROAD_TIERS.map(t=>[t,
      roads.filter(l=>classifyRoadLayer(l,original.get(l.id))===t).length])) as Record<RoadTier,number>;
    const mixed=roads.filter(l=>classifyRoadLayer(l,original.get(l.id))===null).length;
    return {roads:roads.length,mixed,classified};
  },[layers,baseStyle]);
  const setRoad=(key:RoadTier,value:number)=>
    onChange({...settings,roads:{...settings.roads,[key]:value}});
  const setGroup=(key:RoadControlGroup,value:number)=>{
    const roads={...settings.roads};
    for(const tier of ROAD_GROUP_TIERS[key])roads[tier]=value;
    onChange({...settings,roads});
  };
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
    {ROAD_CONTROL_GROUPS.map(group=>{
      const values=ROAD_GROUP_TIERS[group].map(tier=>settings.roads[tier]);
      const same=values.every(v=>v===values[0]);
      const average=Math.round(values.reduce((sum,v)=>sum+v,0)/values.length);
      return <div className="atlas-detail-row" key={group}>
        <div className="atlas-detail-top">
          <span><strong className="atlas-detail-label">{groupNames[group].name}</strong>
            <small className="atlas-detail-subline">{groupNames[group].description}</small></span>
          <span className="atlas-detail-value">{same?values[0]+"%":average+"% avg"}</span>
        </div>
        <input className="atlas-detail-slider" type="range"
          aria-label={groupNames[group].name+" opacity"} min="0" max="100" step="1"
          value={average} onChange={e=>setGroup(group,Number(e.target.value))}/>
        {!same&&<small className="atlas-detail-subline">Preset varies by road subtype. Moving this slider changes only this group.</small>}
      </div>;
    })}
    <details className="atlas-design-fold" open>
      <summary>Fine-tune road subcategories <span>five exclusive tiers</span></summary>
      <div className="atlas-detail-fine">
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
      </div>
    </details>
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
      Primary and Secondary Roads use disjoint road classes. For a provider layer containing both,
      Atlas styles the individual road features rather than affecting the entire layer.
      Presets can retain finer variation within each group; manual edits survive preset switching.
    </p>
  </section>;
}
