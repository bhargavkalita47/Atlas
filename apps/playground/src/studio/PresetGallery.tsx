import {useMemo,useState} from "react";
import {
  ATLAS_STYLE_PRESETS,deriveSemanticPalette,type AtlasPresetDefinition
} from "@atlas/style-core";
import {Check,Layers3,Search} from "lucide-react";

type Props={
  activePresetId:string|null;
  basePresetId:string;
  palette:readonly string[]|null;
  onApply:(id:string)=>void;
};
const FAMILY_NAMES={
  minimal:"Minimal",editorial:"Editorial",expressive:"Expressive",
  utility:"Functional",nature:"Nature",travel:"Destinations",
  retro:"Retro",futuristic:"Futuristic"
} as const;
type Family=keyof typeof FAMILY_NAMES;
const familyOrder:readonly Family[]=["minimal","editorial","nature","travel","retro","futuristic","expressive","utility"];
function Preview({preset,palette}:{preset:AtlasPresetDefinition;palette:readonly string[]|null}){
  const colors=palette?deriveSemanticPalette(preset.id,palette):preset.palette;
  return <span className="atlas-preset-preview" aria-hidden="true" style={{background:colors.land}}>
    <span className="atlas-preset-park" style={{background:colors.parks}}/>
    <span className="atlas-preset-water" style={{background:colors.water}}/>
    <span className="atlas-preset-building b1" style={{background:colors.buildings}}/>
    <span className="atlas-preset-building b2" style={{background:colors.buildings}}/>
    <span className="atlas-preset-building b3" style={{background:colors.buildings}}/>
    <span className="atlas-preset-road r1" style={{background:colors.roads}}/>
    <span className="atlas-preset-road r2" style={{background:colors.roads}}/>
    <span className="atlas-preset-road r3" style={{background:colors.roads}}/>
    <span className="atlas-preset-map-label" style={{color:colors.labels}}>ATLAS</span>
  </span>;
}
export function PresetGallery({activePresetId,basePresetId,palette,onApply}:Props){
  const [family,setFamily]=useState<Family|"all">("all");
  const [search,setSearch]=useState("");
  const [visible,setVisible]=useState(12);
  const matching=useMemo(()=>ATLAS_STYLE_PRESETS.filter(p=>
    (family==="all"||p.family===family)&&
    (!search||[p.name,p.summary,p.family].some(s=>s.toLowerCase().includes(search.trim().toLowerCase())))
  ),[family,search]);
  return <section className="pane-section atlas-preset-section">
    <div className="section-heading">
      <div className="section-label">ATLAS PRESET LIBRARY</div>
      <span className="atlas-preset-total">{ATLAS_STYLE_PRESETS.length} themes</span>
    </div>
    <p className="atlas-preset-intro">Browse map aesthetics by category. Apply a 4–6-colour palette below to automatically reskin any preset without replacing its underlying style rules.</p>
    <div className="atlas-preset-search">
      <Search size={15}/>
      <input aria-label="Search map presets" placeholder="Search themes…" value={search}
        onChange={event=>{setSearch(event.target.value);setVisible(12);}}/>
    </div>
    <div className="atlas-preset-categories" role="group" aria-label="Preset categories">
      <button type="button" aria-pressed={family==="all"} className={family==="all"?"selected":""}
        onClick={()=>{setFamily("all");setVisible(12);}}>All</button>
      {familyOrder.map(value=><button type="button" key={value} aria-pressed={family===value}
        className={family===value?"selected":""}
        onClick={()=>{setFamily(value);setVisible(12);}}>{FAMILY_NAMES[value]}</button>)}
    </div>
    <div className="atlas-preset-results" aria-live="polite">{matching.length} matching presets</div>
    <div className="atlas-preset-grid" role="group" aria-label="Atlas map theme presets">
      {matching.slice(0,visible).map(preset=><button
        type="button"
        key={preset.id}
        aria-label={"Apply "+preset.name+" preset"}
        aria-pressed={activePresetId===preset.id}
        className={"atlas-preset-card"+(basePresetId===preset.id?" is-active":"")}
        onClick={()=>onApply(preset.id)}
      >
        <Preview preset={preset} palette={palette}/>
        <span className="atlas-preset-card-copy">
          <strong>{preset.name}</strong>
          <small>{preset.summary}</small>
          <span className="atlas-preset-card-meta">{FAMILY_NAMES[preset.family]} · {preset.baseStyle} base</span>
        </span>
        {basePresetId===preset.id&&<span className="atlas-preset-selected" aria-hidden="true"><Check size={13}/></span>}
      </button>)}
    </div>
    {matching.length===0&&<div className="muted-tip">No presets found. Try another name or category.</div>}
    {matching.length>visible&&<button type="button" className="secondary-button atlas-preset-loadmore"
      onClick={()=>setVisible(n=>n+12)}>Show more ({matching.length-visible} remaining)</button>}
    <div className="atlas-preset-status" role="status">
      <Layers3 size={14}/>
      <span>{activePresetId
        ? <>Selected: <strong>{ATLAS_STYLE_PRESETS.find(p=>p.id===activePresetId)?.name??"Preset"}</strong>{palette?" · palette applied":""}</>
        : <><strong>Custom theme</strong> derived from {ATLAS_STYLE_PRESETS.find(p=>p.id===basePresetId)?.name??"preset"}{palette?" · palette applied":""}</>}
      </span>
    </div>
  </section>;
}
