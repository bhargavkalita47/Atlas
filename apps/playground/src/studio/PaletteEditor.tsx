import {useEffect,useMemo,useState} from "react";
import {
  contrastRatio,deriveSemanticPalette,getAtlasPreset,mixPaletteColors,
  normalizeHexColor,parseHexPalette,type SemanticPalette
} from "@atlas/style-core";
import {Check,Palette,Plus,RotateCcw,Trash2} from "lucide-react";

type Props={
  presetId:string;
  colors:readonly string[]|null;
  onChange:(colors:string[]|null)=>void;
};
export const STARTER_PALETTES:readonly {id:string;name:string;colors:readonly string[]}[]=[
  {id:"sage",name:"Sage Paper",colors:["#FAF9F6","#B8D8D8","#A9C7B5","#E6D2BC","#334F47"]},
  {id:"sunset",name:"Sunset",colors:["#FFF2E2","#70A6C9","#F3B88B","#DF756E","#613D52"]},
  {id:"nordic",name:"Nordic",colors:["#F3F5F5","#93BDD2","#9FC5B9","#D8C8B0","#345467"]},
  {id:"cobalt",name:"Cobalt",colors:["#E9F0FC","#3577BB","#96C8BE","#6F76C3","#182D57"]},
  {id:"orchid",name:"Orchid",colors:["#F7F0FF","#97B6DF","#B8D9BD","#C99FD3","#4A345C"]},
  {id:"desert",name:"Desert",colors:["#F8E5BF","#A6BAC1","#B7C28F","#D68B59","#6B4835"]},
  {id:"rose",name:"Rosewater",colors:["#FBEFEC","#AFD6E3","#C5DECA","#DCA7B5","#513E54"]},
  {id:"neon",name:"Neon",colors:["#14162A","#2F73B9","#39CFA8","#F46DBD","#F5E7FF"]},
  {id:"autumn",name:"Autumn",colors:["#F8EDDB","#97B6BF","#ADBE8A","#C77A43","#614638"]},
  {id:"ocean",name:"Ocean",colors:["#E5F7F7","#58B8D1","#8ECABD","#5E85AD","#26495D"]},
  {id:"mono",name:"Monochrome",colors:["#F5F5F3","#D6D9DA","#AAB0B3","#717B83","#29333A"]},
  {id:"aurora",name:"Aurora",colors:["#14252F","#2F7094","#53B8A1","#A37AC5","#F2E8FA"]},
];
const roles:readonly [keyof SemanticPalette,string][]= [
  ["land","Land"],["water","Water"],["parks","Parks"],["roads","Roads"],
  ["buildings","Buildings"],["labels","Labels"],["boundaries","Boundaries"],
  ["transit","Transit"],["poi","POIs"],["terrain","Terrain"]
];
function suggestedColors(presetId:string):string[]{
  const color=getAtlasPreset(presetId).palette;
  return [color.land,color.water,color.parks,color.buildings,color.labels];
}
export function PaletteEditor({presetId,colors,onChange}:Props){
  const [input,setInput]=useState("");
  const [error,setError]=useState("");
  const [drafts,setDrafts]=useState<Record<number,string>>({});
  const derived=useMemo(()=>colors?deriveSemanticPalette(presetId,colors):null,[presetId,colors]);
  useEffect(()=>{setDrafts({});},[colors]);
  const update=(next:string[])=>{setError("");onChange(next);};
  const applyText=()=>{
    try{
      update(parseHexPalette(input));
      setInput("");
    }catch(e){setError(e instanceof Error?e.message:"Enter 4–6 valid hex colours.");}
  };
  return <section className="pane-section atlas-palette-section" aria-label="Automatic palette reskinning">
    <div className="section-heading">
      <div className="section-label">AUTO PALETTE RESKIN</div>
      <span className="atlas-palette-badge">4–6 colours</span>
    </div>
    <p className="atlas-preset-intro">Choose a palette and Atlas automatically maps its colours to land, water, greenery, roads, buildings and labels, preserving the selected preset's light or dark character.</p>
    <div className="atlas-palette-starters" role="group" aria-label="Ready-made colour palettes">
      {STARTER_PALETTES.map(p=><button key={p.id} type="button" className="atlas-palette-starter"
        aria-label={"Use "+p.name+" palette"} onClick={()=>update([...p.colors])}>
        <span className="atlas-palette-mini" aria-hidden="true">
          {p.colors.map((hex,i)=><i key={i} style={{background:hex}}/>)}
        </span>
        <small>{p.name}</small>
        {colors?.join(",").toUpperCase()===p.colors.join(",").toUpperCase()&&<Check size={12}/>}
      </button>)}
    </div>
    {!colors?<button type="button" className="secondary-button atlas-enable-palette"
        onClick={()=>update(suggestedColors(presetId))}><Palette size={16}/> Enable custom palette</button>
    : <>
      <div className="atlas-palette-heading">
        <strong>Your colours</strong>
        <button type="button" className="quiet-button" onClick={()=>{setError("");onChange(null);}}><RotateCcw size={13}/> Restore preset colours</button>
      </div>
      <div className="atlas-palette-slots" role="group" aria-label="Custom palette swatches">
        {colors.map((hex,index)=><div className="atlas-palette-slot" key={index}>
          <input aria-label={"Palette colour "+(index+1)} type="color" value={hex}
            onChange={event=>{
              update(colors.map((entry,i)=>i===index?event.target.value:entry));
            }}/>
          <input aria-label={"Palette hex "+(index+1)} type="text"
            spellCheck={false} maxLength={7} value={drafts[index]??hex}
            onChange={event=>{
              const value=event.target.value;
              setDrafts(prev=>({...prev,[index]:value}));
              try{
                const next=normalizeHexColor(value);
                update(colors.map((entry,i)=>i===index?next:entry));
              }catch{ /* Keep partial input without applying invalid colours. */ }
            }}
            onBlur={()=>setDrafts(prev=>{const next={...prev};delete next[index];return next;})}/>
          <button type="button" aria-label={"Remove palette colour "+(index+1)}
            disabled={colors.length<=4}
            onClick={()=>update(colors.filter((_,i)=>i!==index))}><Trash2 size={14}/></button>
        </div>)}
      </div>
      <button type="button" className="atlas-palette-add" disabled={colors.length>=6}
        onClick={()=>update([...colors,mixPaletteColors(colors[0]!,colors[colors.length-1]!,.5)])}>
        <Plus size={14}/> Add colour ({colors.length}/6)
      </button>
    </>}
    <div className="atlas-palette-paste">
      <label htmlFor="atlas-palette-paste-field">Paste your palette</label>
      <textarea id="atlas-palette-paste-field" aria-label="Paste palette colours"
        placeholder="#F7F7F5, #B8DDF3, #A5C4AE, #DCA58D, #263844"
        rows={2} value={input} onChange={event=>{setInput(event.target.value);setError("");}}/>
      <button type="button" className="secondary-button" onClick={applyText}
        disabled={!input.trim()}>Apply 4–6 colours</button>
      {error&&<p className="atlas-palette-error" role="alert">{error}</p>}
    </div>
    {derived&&<>
      <div className="atlas-palette-generated">
        <div className="atlas-palette-heading"><strong>Automatically generated map roles</strong><span>10 outputs</span></div>
        <div className="atlas-palette-role-grid">
          {roles.map(([role,name])=><div className="atlas-palette-role" key={role}>
            <span style={{background:derived[role]}}/>
            <small>{name}</small><code>{derived[role]}</code>
          </div>)}
        </div>
      </div>
      <p className="atlas-palette-contrast">Label / land contrast: <strong>{contrastRatio(derived.labels,derived.land).toFixed(1)}:1</strong>. Actual map readability also depends on imagery, label placement and provider layers.</p>
    </>}
  </section>;
}
