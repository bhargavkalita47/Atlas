import {useMemo} from "react";
import {
  ROAD_TIERS,LABEL_ROLES,DETAIL_FEATURES,availableProviderFonts,
  type AdvancedStyleSettings,type RoadTier,type LabelRole,type DetailFeature,
  type RoadDesign,type LabelDesign,type ZoomRange
} from "@atlas/style-core";
import {Route,Type,ZoomIn,RotateCcw} from "lucide-react";

type Props={settings:AdvancedStyleSettings;onChange:(settings:AdvancedStyleSettings)=>void;baseStyle:unknown};
const roadNames:Record<RoadTier,string>={
  motorway:"Motorways & expressways",primary:"Primary roads",
  secondary:"Secondary & tertiary roads",local:"Local & residential",
  paths:"Service roads & paths"
};
const labelNames:Record<LabelRole,string>={
  city:"Cities & major places",locality:"Localities & neighbourhoods",
  road:"Road and street names",poi:"Points of interest"
};
const featureNames:Record<DetailFeature,string>={
  buildings:"Buildings",water:"Water",parks:"Parks & vegetation",
  placeLabels:"All place labels",roadLabels:"All road labels",poi:"POIs",
  transit:"Transit & rail",boundaries:"Boundaries",terrain:"Terrain"
};
const emptyColor="#8495ae";
function OverrideColor({name,value,onChange,defaultColor}:{name:string,value:string|null,defaultColor:string,onChange:(value:string|null)=>void}){
  return <label className="atlas-design-control atlas-design-color-control">
    <span>{name}</span>
    <input type="checkbox" aria-label={name+" custom"} checked={value!==null}
      onChange={e=>onChange(e.target.checked?defaultColor:null)}/>
    <input type="color" aria-label={name+" color"} disabled={value===null}
      value={value??defaultColor} onChange={e=>onChange(e.target.value)}/>
  </label>;
}
function OverrideSlider({name,value,min,max,step,unit,onChange,initial}:{name:string,value:number|null,min:number,max:number,step:number,unit:string,initial:number,onChange:(v:number|null)=>void}){
  return <div className="atlas-design-control">
    <label>
      <span>{name}</span>
      <input type="checkbox" aria-label={name+" custom"} checked={value!==null}
        onChange={e=>onChange(e.target.checked?initial:null)}/>
    </label>
    <div className="atlas-design-sliderline">
      <input type="range" aria-label={name} min={min} max={max} step={step}
        disabled={value===null} value={value??initial}
        onChange={e=>onChange(Number(e.target.value))}/>
      <output>{value===null?"Preset":value+unit}</output>
    </div>
  </div>;
}
function VisibleSelector({name,value,onChange}:{name:string,value:boolean|null,onChange:(v:boolean|null)=>void}){
  return <label className="atlas-design-control">
    <span>{name}</span>
    <select aria-label={name+" visibility"} value={value===null?"inherit":value?"show":"hide"}
      onChange={e=>onChange(e.target.value==="inherit"?null:e.target.value==="show")}>
      <option value="inherit">Preset</option><option value="show">Show</option><option value="hide">Hide</option>
    </select>
  </label>;
}
function RangeField({name,range,onChange}:{name:string,range:ZoomRange,onChange:(next:ZoomRange)=>void}){
  const write=(field:"min"|"max",raw:string)=>{
    const parsed=raw.trim()===""?null:Number(raw);
    if(parsed!==null&&!Number.isFinite(parsed))return;
    const value=parsed===null?null:Math.max(field==="min"?0:1,Math.min(field==="min"?22:24,parsed));
    const next={...range,[field]:value};
    if(next.min!==null&&next.max!==null&&next.min>=next.max){
      if(field==="min")next.max=null;
      else next.min=null;
    }
    onChange(next);
  };
  return <div className="atlas-zoom-row">
    <strong>{name}</strong>
    <label><span>From z</span><input type="number" min="0" max="22" step="1"
      aria-label={name+" min zoom"} placeholder="Auto"
      value={range.min??""} onChange={e=>write("min",e.target.value)}/></label>
    <label><span>Until z</span><input type="number" min="1" max="24" step="1"
      aria-label={name+" max zoom"} placeholder="Auto"
      value={range.max??""} onChange={e=>write("max",e.target.value)}/></label>
  </div>;
}
export function AdvancedRoadPanel({settings,onChange,baseStyle}:Props){
  const styleLayers=useMemo(()=>{
    if(!baseStyle||typeof baseStyle!=="object")return [];
    const layers=(baseStyle as {layers?:unknown}).layers;
    return Array.isArray(layers)?layers as Array<{id?:string}>:[];
  },[baseStyle]);
  const hasCasings=styleLayers.some(l=>typeof l.id==="string"&&/casing|outline|border/i.test(l.id)&&/road|street|highway|transport/i.test(l.id));
  const set=(tier:RoadTier,changes:Partial<RoadDesign>)=>onChange({
    ...settings,roads:{...settings.roads,[tier]:{...settings.roads[tier],...changes}}
  });
  return <section className="pane-section atlas-advanced-panel" aria-label="Advanced road styling">
    <div className="section-heading"><div className="section-label"><Route size={14}/> ADVANCED ROAD STYLING</div></div>
    <p className="atlas-detail-intro">Colours, thickness, casing, dash pattern and visibility for each road class. Existing road-opacity sliders remain under Map Detail Controls.</p>
    {ROAD_TIERS.map(tier=><details className="atlas-design-fold" key={tier} open={tier==="primary"||tier==="secondary"?true:undefined}>
      <summary>{roadNames[tier]}<span>Style</span></summary>
      <div className="atlas-design-grid">
        <OverrideColor name={roadNames[tier]+" road"} value={settings.roads[tier].color} defaultColor="#7194c5"
          onChange={color=>set(tier,{color})}/>
        <OverrideSlider name={roadNames[tier]+" width"} value={settings.roads[tier].width} initial={3}
          min={.25} max={24} step={.25} unit=" px" onChange={width=>set(tier,{width})}/>
        <OverrideColor name={roadNames[tier]+" casing"} value={settings.roads[tier].outlineColor} defaultColor="#485f82"
          onChange={outlineColor=>set(tier,{outlineColor})}/>
        <OverrideSlider name={roadNames[tier]+" casing width"} value={settings.roads[tier].outlineWidth} initial={4}
          min={.25} max={32} step={.25} unit=" px" onChange={outlineWidth=>set(tier,{outlineWidth})}/>
        <label className="atlas-design-control"><span>Line pattern</span>
          <select aria-label={roadNames[tier]+" dash pattern"} value={settings.roads[tier].dash}
            onChange={e=>set(tier,{dash:e.target.value as RoadDesign["dash"]})}>
            <option value="inherit">Preset</option><option value="solid">Solid</option><option value="dashed">Dashed</option>
          </select>
        </label>
        <VisibleSelector name={roadNames[tier]} value={settings.roads[tier].visible}
          onChange={visible=>set(tier,{visible})}/>
      </div>
    </details>)}
    <p className="atlas-detail-footnote">
      Casing changes modify existing provider casing layers{hasCasings?" (detected in this map).":" (none detected in this map)."}
      On mixed road layers, Atlas matches the road class per feature. Some providers do not expose every category.
    </p>
  </section>;
}
export function TypographyPanel({settings,onChange,baseStyle}:Props){
  const fonts=useMemo(()=>availableProviderFonts(baseStyle),[baseStyle]);
  const set=(role:LabelRole,changes:Partial<LabelDesign>)=>onChange({
    ...settings,labels:{...settings.labels,[role]:{...settings.labels[role],...changes}}
  });
  return <section className="pane-section atlas-advanced-panel" aria-label="Typography studio">
    <div className="section-heading"><div className="section-label"><Type size={14}/> TYPOGRAPHY STUDIO</div></div>
    <p className="atlas-detail-intro">Adjust map label hierarchy independently. Sizes scale the provider's existing zoom-aware typography. Font choices are limited to stacks already referenced by this map's source style.</p>
    {LABEL_ROLES.map(role=><details className="atlas-design-fold" key={role} open={role==="city"||role==="road"?true:undefined}>
      <summary>{labelNames[role]}<span>Type</span></summary>
      <div className="atlas-design-grid">
        <OverrideColor name={labelNames[role]+" text"} value={settings.labels[role].color} defaultColor={emptyColor}
          onChange={color=>set(role,{color})}/>
        <OverrideSlider name={labelNames[role]+" size"} value={settings.labels[role].sizeScale} initial={1}
          min={.5} max={2.5} step={.05} unit=" ×" onChange={sizeScale=>set(role,{sizeScale})}/>
        <OverrideSlider name={labelNames[role]+" tracking"} value={settings.labels[role].spacing} initial={0}
          min={-.1} max={.4} step={.01} unit=" em" onChange={spacing=>set(role,{spacing})}/>
        <label className="atlas-design-control"><span>Font stack / weight</span>
          <select aria-label={labelNames[role]+" font"} value={settings.labels[role].fontStack===null?"":JSON.stringify(settings.labels[role].fontStack)}
            onChange={e=>set(role,{fontStack:e.target.value?JSON.parse(e.target.value) as string[]:null})}>
            <option value="">Provider default</option>
            {fonts.map(font=><option key={JSON.stringify(font)} value={JSON.stringify(font)}>{font.join(" / ")}</option>)}
          </select>
        </label>
        <VisibleSelector name={labelNames[role]} value={settings.labels[role].visible}
          onChange={visible=>set(role,{visible})}/>
      </div>
    </details>)}
    <p className="atlas-detail-footnote">{fonts.length} provider font stack{fonts.length===1?"":"s"} available. Additional font files are not downloaded merely by selecting a style control. Dark theme text halos remain disabled.</p>
  </section>;
}
export function ZoomDetailPanel({settings,onChange}:Omit<Props,"baseStyle">){
  const roads=(tier:RoadTier,zoom:ZoomRange)=>onChange({
    ...settings,roads:{...settings.roads,[tier]:{...settings.roads[tier],zoom}}
  });
  const labels=(role:LabelRole,zoom:ZoomRange)=>onChange({
    ...settings,labels:{...settings.labels,[role]:{...settings.labels[role],zoom}}
  });
  const features=(key:DetailFeature,zoom:ZoomRange)=>onChange({
    ...settings,features:{...settings.features,[key]:zoom}
  });
  const reset=()=>onChange({...settings,roads:Object.fromEntries(ROAD_TIERS.map(k=>[k,{...settings.roads[k],zoom:{min:null,max:null}}])) as typeof settings.roads,
    labels:Object.fromEntries(LABEL_ROLES.map(k=>[k,{...settings.labels[k],zoom:{min:null,max:null}}])) as typeof settings.labels,
    features:Object.fromEntries(DETAIL_FEATURES.map(k=>[k,{min:null,max:null}])) as typeof settings.features});
  return <section className="pane-section atlas-advanced-panel" aria-label="Zoom-dependent map detail">
    <div className="section-heading"><div className="section-label"><ZoomIn size={14}/> ZOOM-DEPENDENT DETAIL</div>
      <button type="button" className="quiet-button" onClick={reset}><RotateCcw size={13}/> Reset zoom rules</button></div>
    <p className="atlas-detail-intro">Set when each category first appears or disappears as you zoom. “Auto” follows the underlying map provider's zoom rules.</p>
    <details className="atlas-design-fold" open><summary>Road class zoom ranges<span>5 classes</span></summary>
      {ROAD_TIERS.map(tier=><RangeField key={tier} name={roadNames[tier]} range={settings.roads[tier].zoom}
        onChange={zoom=>roads(tier,zoom)}/>)}
    </details>
    <details className="atlas-design-fold" open><summary>Label zoom ranges<span>4 types</span></summary>
      {LABEL_ROLES.map(role=><RangeField key={role} name={labelNames[role]} range={settings.labels[role].zoom}
        onChange={zoom=>labels(role,zoom)}/>)}
    </details>
    <details className="atlas-design-fold"><summary>Map feature zoom ranges<span>9 types</span></summary>
      {DETAIL_FEATURES.map(feature=><RangeField key={feature} name={featureNames[feature]}
        range={settings.features[feature]} onChange={zoom=>features(feature,zoom)}/>)}
    </details>
    <p className="atlas-detail-footnote">A hidden feature cannot render at any zoom. Rules cannot create missing geographic data. Feature-specific road zoom thresholds depend on the vector provider's class properties.</p>
  </section>;
}
