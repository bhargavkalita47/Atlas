import {ATLAS_STYLE_PRESETS,type AtlasPresetDefinition} from "@atlas/style-core";
import {Check,Layers3} from "lucide-react";

type Props={
  activePresetId:string|null;
  onApply:(id:string)=>void;
};
function Preview({preset}:{preset:AtlasPresetDefinition}){
  const colors=preset.palette;
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
export function PresetGallery({activePresetId,onApply}:Props){
  return <section className="pane-section atlas-preset-section">
    <div className="section-heading">
      <div className="section-label">ATLAS PRESET LIBRARY</div>
      <span className="atlas-preset-total">{ATLAS_STYLE_PRESETS.length} themes</span>
    </div>
    <p className="atlas-preset-intro">Select a complete map aesthetic, then fine-tune its colours or individual layers. Each preset includes its own vector starting style.</p>
    <div className="atlas-preset-grid" role="group" aria-label="Atlas map theme presets">
      {ATLAS_STYLE_PRESETS.map(preset=><button
        type="button"
        key={preset.id}
        aria-label={"Apply "+preset.name+" preset"}
        aria-pressed={activePresetId===preset.id}
        className={"atlas-preset-card"+(activePresetId===preset.id?" is-active":"")}
        onClick={()=>onApply(preset.id)}
      >
        <Preview preset={preset}/>
        <span className="atlas-preset-card-copy">
          <strong>{preset.name}</strong>
          <small>{preset.summary}</small>
          <span className="atlas-preset-card-meta">
            {preset.baseStyle==="positron"?"Positron":preset.baseStyle==="dark"?"Dark":preset.baseStyle==="liberty"?"Liberty":"Bright"} base
          </span>
        </span>
        {activePresetId===preset.id&&<span className="atlas-preset-selected" aria-hidden="true"><Check size={13}/></span>}
      </button>)}
    </div>
    <div className="atlas-preset-status" role="status">
      <Layers3 size={14}/>
      {activePresetId
        ? <>Active: <strong>{ATLAS_STYLE_PRESETS.find(p=>p.id===activePresetId)?.name??"Preset"}</strong></>
        : <><strong>Custom theme</strong> · your changes are active</>}
    </div>
  </section>;
}
