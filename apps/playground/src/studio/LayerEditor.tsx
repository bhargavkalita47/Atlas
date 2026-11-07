import {useMemo,useState} from "react";
import type {AtlasStyleDocument,JsonValue,LayerOverride,StyleGroup,StyleLayerDescriptor} from "@atlas/style-core";
import {STYLE_GROUPS} from "@atlas/style-core";

type Props={
  layers:readonly StyleLayerDescriptor[];
  document:AtlasStyleDocument;
  onChange:(document:AtlasStyleDocument)=>void;
};
const colorProperties:Record<string,string|undefined>={
  background:"background-color",fill:"fill-color",line:"line-color",
  symbol:"text-color",circle:"circle-color","fill-extrusion":"fill-extrusion-color"
};
const opacityProperties:Record<string,string|undefined>={
  background:"background-opacity",fill:"fill-opacity",line:"line-opacity",
  symbol:"text-opacity",circle:"circle-opacity","fill-extrusion":"fill-extrusion-opacity",raster:"raster-opacity"
};
const label=(value:string)=>value.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const colorValue=(value:unknown):value is string=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);

export function LayerEditor({layers,document,onChange}:Props){
  const [search,setSearch]=useState("");
  const [group,setGroup]=useState<StyleGroup|"all"|"unmapped">("all");
  const [picked,setPicked]=useState("");
  const filtered=useMemo(()=>layers.filter(layer=>
    (group==="all"||(group==="unmapped"?layer.suggestedGroup===null:layer.suggestedGroup===group))&&
    (!search||[layer.id,layer.source??"",layer.sourceLayer??""].some(s=>s.toLowerCase().includes(search.toLowerCase())))
  ),[layers,group,search]);
  const selected=filtered.find(l=>l.id===picked)??filtered[0];
  const layerId=selected?.id??"";
  const override=selected?document.layers[layerId]:undefined;
  const paintColor=selected?colorProperties[selected.type]:undefined;
  const paintOpacity=selected?opacityProperties[selected.type]:undefined;
  const groupColor=selected?.suggestedGroup?document.groups[selected.suggestedGroup]?.color:undefined;
  const resolvedColor=paintColor&&colorValue(override?.paint?.[paintColor])?override.paint[paintColor] as string:
    colorValue(groupColor)?groupColor:"#8D96A2";
  const overrideOpacity=paintOpacity&&typeof override?.paint?.[paintOpacity]==="number"?override.paint[paintOpacity] as number:undefined;
  const overrideWidth=typeof override?.paint?.["line-width"]==="number"?override.paint["line-width"] as number:undefined;
  const patch=(update:(previous:LayerOverride)=>LayerOverride)=>{
    if(!selected)return;
    const next=update({...document.layers[layerId]});
    const changed={...document.layers};
    if(!next.paint&&!next.layout&&next.filter===undefined&&next.minzoom===undefined&&next.maxzoom===undefined)delete changed[layerId];
    else changed[layerId]=next;
    onChange({...document,layers:changed});
  };
  const setPaint=(property:string,value:JsonValue|undefined)=>patch(layer=>{
    const paint={...layer.paint};
    if(value===undefined)delete paint[property];
    else paint[property]=value;
    if(Object.keys(paint).length)layer.paint=paint;
    else delete layer.paint;
    return layer;
  });
  const setVisibility=(value:string)=>patch(layer=>{
    const layout={...layer.layout};
    if(value==="inherit")delete layout.visibility;
    else layout.visibility=value;
    if(Object.keys(layout).length)layer.layout=layout;
    else delete layer.layout;
    return layer;
  });
  return <section className="pane-section atlas-layer-editor">
    <div className="section-heading"><div className="section-label">EDITABLE MAP LAYERS · {layers.length}</div>
      <span className="atlas-layer-count">{Object.keys(document.layers).length} overridden</span></div>
    <div className="atlas-layer-filter">
      <input aria-label="Search map layers" placeholder="Search layer or source…" value={search}
        onChange={event=>setSearch(event.target.value)}/>
      <select aria-label="Filter map layers by group" value={group}
        onChange={event=>{setGroup(event.target.value as typeof group);setPicked("");}}>
        <option value="all">All layer groups</option>
        {STYLE_GROUPS.map(name=><option key={name} value={name}>{label(name)}</option>)}
        <option value="unmapped">Unmapped / raw</option>
      </select>
    </div>
    <div className="atlas-layer-list" role="group" aria-label="Map layer inventory">
      {filtered.length===0?<div className="muted-tip">No matching map layers. The vector style may still be loading.</div>:
        filtered.map(layer=><button type="button" key={layer.id} className={"atlas-layer-choice"+(selected?.id===layer.id?" selected":"")}
          aria-pressed={selected?.id===layer.id} onClick={()=>setPicked(layer.id)}>
          <span className="atlas-layer-icon">{layer.type==="symbol"?"T":layer.type==="line"?"—":layer.type==="fill"?"▰":"·"}</span>
          <span><strong>{layer.id}</strong><small>{layer.suggestedGroup??"Unmapped"} · {layer.type}</small></span>
          {document.layers[layer.id]&&<span className="atlas-layer-dot" aria-label="Customized"/>}
        </button>)}
    </div>
    {selected&&<div className="atlas-layer-inspector">
      <div className="section-heading"><div className="section-label">SELECTED LAYER</div>
        <button type="button" className="quiet-button" onClick={()=>{const next={...document.layers};delete next[layerId];onChange({...document,layers:next});}}
          disabled={!override}>Reset selected layer</button></div>
      <div className="atlas-layer-meta"><strong>{selected.id}</strong>
        <span>Type: {selected.type}</span>
        <span>Source: {selected.source??"None"} / {selected.sourceLayer??"N/A"}</span>
        <span>Suggested group: {selected.suggestedGroup??"Unmapped"} (review before publishing)</span></div>
      <label className="atlas-layer-field">Visibility
        <select aria-label="Layer visibility" value={override?.layout?.visibility==="none"?"none":override?.layout?.visibility==="visible"?"visible":"inherit"}
          onChange={event=>setVisibility(event.target.value)}>
          <option value="inherit">Inherit original</option><option value="visible">Show layer</option><option value="none">Hide layer</option>
        </select>
      </label>
      {paintColor&&<label className="atlas-layer-field">Colour override
        <div className="atlas-layer-color">
          <input type="color" aria-label="Layer color" value={resolvedColor}
            onChange={event=>setPaint(paintColor,event.target.value)}/>
          <code>{resolvedColor}</code>
          <button type="button" className="quiet-button" disabled={override?.paint?.[paintColor]===undefined}
            onClick={()=>setPaint(paintColor,undefined)}>Inherit</button>
        </div>
      </label>}
      {paintOpacity&&<label className="atlas-layer-field">Opacity override
        <div className="atlas-layer-scale">
          <input type="range" aria-label="Layer opacity" min="0" max="100" step="5"
            value={Math.round((overrideOpacity??1)*100)}
            onChange={event=>setPaint(paintOpacity,Number(event.target.value)/100)}/>
          <span>{overrideOpacity===undefined?"Inherited":Math.round(overrideOpacity*100)+"%"}</span>
          <button type="button" className="quiet-button" disabled={overrideOpacity===undefined}
            onClick={()=>setPaint(paintOpacity,undefined)}>Clear</button>
        </div>
      </label>}
      {selected.type==="line"&&<label className="atlas-layer-field">Width override
        <div className="atlas-layer-scale">
          <input type="range" aria-label="Layer width" min="0" max="16" step="0.5"
            value={overrideWidth??2} onChange={event=>setPaint("line-width",Number(event.target.value))}/>
          <span>{overrideWidth===undefined?"Inherited":overrideWidth+" px"}</span>
          <button type="button" className="quiet-button" disabled={overrideWidth===undefined}
            onClick={()=>setPaint("line-width",undefined)}>Clear</button>
        </div>
      </label>}
      <div className="muted-tip">An override replaces the source style's original value or expression. Use Inherit or Reset to restore it. Additional properties are planned for the advanced inspector.</div>
    </div>}
  </section>;
}
