import {useMemo,useState} from "react";
import {
  SEMANTIC_FAMILIES,SEMANTIC_FEATURES,SEMANTIC_KEYS,
  inspectSemanticCoverage,createSemanticFeatureSettings,
  type SemanticFamily,type SemanticFeature,type SemanticStyleSettings,
  type StyleLayerDescriptor,type FeatureDesign
} from "@atlas/style-core";
import {Layers3,RotateCcw,Search} from "lucide-react";

const groups:Record<SemanticFamily,string>={
  architecture:"Buildings & land use",nature:"Parks & vegetation",
  water:"Water features",poi:"Points of interest",
  boundaries:"Boundaries",transit:"Transit & terrain"
};
const lineKeys=new Set<SemanticFeature>([
  "rivers","streams","countryBorders","regionBorders","localBorders","railways","terrain"
]);
const dashKeys=new Set<SemanticFeature>([
  "rivers","streams","countryBorders","regionBorders","localBorders","railways"
]);
const fillKeys=new Set<SemanticFeature>([
  "buildings","residential","commercial","industrial","parks","forests","grass",
  "gardens","agriculture","waterBodies"
]);
const colours:Partial<Record<SemanticFeature,string>>={
  buildings:"#B8C2D1",residential:"#D2D9EA",commercial:"#DBB8A0",industrial:"#BBAEB5",
  parks:"#9ABD89",forests:"#567F68",grass:"#B1C988",gardens:"#86BB86",agriculture:"#CEBE94",
  waterBodies:"#75AFDD",rivers:"#539AD5",streams:"#87BEE4",
  poiHealth:"#D36E76",poiEducation:"#6E83C5",poiFood:"#CE9567",
  poiShopping:"#B17EB3",poiLandmarks:"#BB9B49",poiTransit:"#598FB8",
  countryBorders:"#7C7A95",regionBorders:"#A29AB7",localBorders:"#BAB2C1",
  railways:"#696D87",terrain:"#A8B29C"
};
type Props={
  layers:readonly StyleLayerDescriptor[];
  baseStyle:unknown;
  settings:SemanticStyleSettings;
  onChange:(next:SemanticStyleSettings)=>void;
};
function tri(v:boolean|null):string{return v===null?"inherit":v?"show":"hide";}
export function SemanticFeaturesPanel({layers,baseStyle,settings,onChange}:Props){
  const [family,setFamily]=useState<SemanticFamily>("architecture");
  const [query,setQuery]=useState("");
  const coverage=useMemo(()=>inspectSemanticCoverage(layers,baseStyle),[layers,baseStyle]);
  const kinds=useMemo(()=>{
    if(!baseStyle||typeof baseStyle!=="object"||!("layers" in baseStyle))return [] as
      Array<{type:string;sourceLayer?:string;layout?:Record<string,unknown>}>;
    return Array.isArray((baseStyle as {layers?:unknown}).layers)
      ?(baseStyle as {layers:Array<{type:string;"source-layer"?:string;layout?:Record<string,unknown>}>}).layers
        .map(l=>({type:l.type,sourceLayer:l["source-layer"],layout:l.layout}))
      :[];
  },[baseStyle]);
  const buildings3d=kinds.some(l=>l.type==="fill-extrusion"&&l.sourceLayer==="building");
  const hasIcons=kinds.some(l=>l.type==="symbol"&&l.sourceLayer==="poi"&&l.layout?.["icon-image"]!==undefined);
  const change=(key:SemanticFeature,values:Partial<FeatureDesign>)=>{
    onChange({...settings,[key]:{...settings[key],...values}});
  };
  const reset=()=>onChange(createSemanticFeatureSettings());
  const listed=SEMANTIC_KEYS.filter(key=>
    SEMANTIC_FEATURES[key].family===family&&
    (!query.trim()||[SEMANTIC_FEATURES[key].name,SEMANTIC_FEATURES[key].hint]
      .join(" ").toLowerCase().includes(query.toLowerCase()))
  );
  const supported=SEMANTIC_KEYS.filter(key=>coverage[key].layers>0).length;
  return <section className="pane-section atlas-features-panel" aria-label="Feature styling studio">
    <div className="section-heading">
      <div className="section-label"><Layers3 size={15}/> FEATURE STYLING</div>
      <button type="button" className="quiet-button" onClick={reset}><RotateCcw size={13}/> Reset features</button>
    </div>
    <p className="atlas-detail-intro">Style only the geographic categories exposed by this map provider. A shared source layer is matched by each feature's class, so changing forests does not recolour grassland or parks.</p>
    <div className="atlas-feature-summary" role="status">
      <strong>{supported} / {SEMANTIC_KEYS.length}</strong> feature categories available or potentially supported
    </div>
    <div className="atlas-feature-nav" role="tablist" aria-label="Feature categories">
      {SEMANTIC_FAMILIES.map(item=>{
        const count=SEMANTIC_KEYS.filter(key=>SEMANTIC_FEATURES[key].family===item.id&&coverage[key].layers>0).length;
        return <button type="button" role="tab" aria-selected={family===item.id}
          key={item.id} className={family===item.id?"active":""}
          onClick={()=>setFamily(item.id)}>
          {groups[item.id]} <small>{count}</small>
        </button>;
      })}
    </div>
    <div className="atlas-feature-search">
      <Search size={14}/><input type="search" aria-label="Find map features"
        placeholder="Find a feature…" value={query} onChange={e=>setQuery(e.target.value)}/>
    </div>
    <div className="atlas-feature-items" role="tabpanel" aria-label={groups[family]}>
      {listed.length===0&&<div className="muted-tip">No features match this search.</div>}
      {listed.map(key=>{
        const cfg=settings[key],info=SEMANTIC_FEATURES[key],support=coverage[key];
        const available=support.layers>0;
        const isLine=lineKeys.has(key);
        const isFill=fillKeys.has(key);
        const isIcon=key.startsWith("poi")&&hasIcons;
        const isExtrusion=key==="buildings"&&buildings3d;
        const color=cfg.color??colours[key]??"#95A2B5";
        const label=info.name;
        return <details key={key} className="atlas-feature-card">
          <summary>
            <span><strong>{label}</strong><small>{info.hint}</small></span>
            <span className={"atlas-feature-support"+(available?" supported":"")}>
              {!available?"Unavailable":support.exact>0?"In map style":"Provider-dependent"}
            </span>
          </summary>
          {available&&<div className="atlas-feature-fields">
            <label className="atlas-design-control atlas-feature-color">
              <span>Fill / line colour</span>
              <input type="checkbox" aria-label={label+" custom colour"}
                checked={cfg.color!==null}
                onChange={e=>change(key,{color:e.target.checked?color:null})}/>
              <input type="color" aria-label={label+" colour"} value={color}
                disabled={cfg.color===null} onChange={e=>change(key,{color:e.target.value})}/>
            </label>
            <label className="atlas-design-control">
              <span>Visibility</span>
              <select aria-label={label+" visibility"} value={tri(cfg.visible)}
                onChange={e=>change(key,{visible:e.target.value==="inherit"?null:e.target.value==="show"})}>
                <option value="inherit">Preset</option><option value="show">Show</option><option value="hide">Hide</option>
              </select>
            </label>
            <div className="atlas-feature-range">
              <div className="atlas-feature-range-header">
                <span>Opacity</span>
                <label><input type="checkbox" aria-label={label+" custom opacity"} checked={cfg.opacity!==null}
                  onChange={e=>change(key,{opacity:e.target.checked?100:null})}/> Custom</label>
                <output>{cfg.opacity===null?"Preset":cfg.opacity+"%"}</output>
              </div>
              <input type="range" min="0" max="100" step="1" value={cfg.opacity??100}
                disabled={cfg.opacity===null} aria-label={label+" opacity"}
                onChange={e=>change(key,{opacity:Number(e.target.value)})}/>
            </div>
            {isLine&&<div className="atlas-feature-range">
              <div className="atlas-feature-range-header">
                <span>Stroke width</span>
                <label><input type="checkbox" aria-label={label+" custom width"} checked={cfg.width!==null}
                  onChange={e=>change(key,{width:e.target.checked?2:null})}/> Custom</label>
                <output>{cfg.width===null?"Preset":cfg.width+" px"}</output>
              </div>
              <input type="range" min=".25" max="20" step=".25" value={cfg.width??2}
                disabled={cfg.width===null} aria-label={label+" width"}
                onChange={e=>change(key,{width:Number(e.target.value)})}/>
            </div>}
            {isFill&&<label className="atlas-design-control atlas-feature-color">
              <span>Outline colour</span>
              <input type="checkbox" checked={cfg.outlineColor!==null} aria-label={label+" custom outline"}
                onChange={e=>change(key,{outlineColor:e.target.checked?"#677B8B":null})}/>
              <input type="color" disabled={cfg.outlineColor===null} aria-label={label+" outline colour"}
                value={cfg.outlineColor??"#677B8B"} onChange={e=>change(key,{outlineColor:e.target.value})}/>
            </label>}
            {dashKeys.has(key)&&<label className="atlas-design-control"><span>Line pattern</span>
              <select aria-label={label+" dash pattern"} value={cfg.dash}
                onChange={e=>change(key,{dash:e.target.value as FeatureDesign["dash"]})}>
                <option value="inherit">Preset</option><option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </label>}
            {isIcon&&<div className="atlas-feature-range">
              <div className="atlas-feature-range-header"><span>Icon size</span>
                <label><input type="checkbox" aria-label={label+" custom icon size"} checked={cfg.iconSize!==null}
                  onChange={e=>change(key,{iconSize:e.target.checked?1:null})}/> Custom</label>
                <output>{cfg.iconSize===null?"Preset":cfg.iconSize+"×"}</output>
              </div>
              <input type="range" min=".5" max="3" step=".1"
                aria-label={label+" icon size"} disabled={cfg.iconSize===null} value={cfg.iconSize??1}
                onChange={e=>change(key,{iconSize:Number(e.target.value)})}/>
            </div>}
            {isExtrusion&&<div className="atlas-feature-range">
              <div className="atlas-feature-range-header"><span>3D height multiplier</span>
                <label><input type="checkbox" aria-label={label+" custom height"} checked={cfg.heightScale!==null}
                  onChange={e=>change(key,{heightScale:e.target.checked?1:null})}/> Custom</label>
                <output>{cfg.heightScale===null?"Preset":cfg.heightScale+"×"}</output>
              </div>
              <input type="range" min=".25" max="3" step=".05"
                aria-label={label+" height"} disabled={cfg.heightScale===null} value={cfg.heightScale??1}
                onChange={e=>change(key,{heightScale:Number(e.target.value)})}/>
            </div>}
            <div className="atlas-feature-zoom">
              <strong>Zoom visibility</strong>
              <label>Start at
                <input type="number" min="0" max="22" placeholder="Auto"
                  aria-label={label+" minimum zoom"} value={cfg.zoom.min??""}
                  onChange={e=>{
                    const min=e.target.value===""?null:Math.max(0,Math.min(22,Number(e.target.value)));
                    const max=cfg.zoom.max!==null&&min!==null&&min>=cfg.zoom.max?null:cfg.zoom.max;
                    change(key,{zoom:{min,max}});
                  }}/>
              </label>
              <label>Hide after
                <input type="number" min="1" max="24" placeholder="Auto"
                  aria-label={label+" maximum zoom"} value={cfg.zoom.max??""}
                  onChange={e=>{
                    const max=e.target.value===""?null:Math.max(1,Math.min(24,Number(e.target.value)));
                    const min=cfg.zoom.min!==null&&max!==null&&max<=cfg.zoom.min?null:cfg.zoom.min;
                    change(key,{zoom:{min,max}});
                  }}/>
              </label>
            </div>
            {support.exact===0&&<p className="atlas-feature-caveat">This provider has a shared source layer, but the selected feature type may not be present in the visible tiles.</p>}
          </div>}
          {!available&&<p className="atlas-feature-caveat">Not exposed by the current base style. Switching to a more detailed provider may add this feature.</p>}
        </details>;
      })}
    </div>
  </section>;
}
