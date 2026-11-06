import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {
  Activity,ArrowLeft,ArrowRight,Check,CheckCircle2,ChevronDown,
  Circle,Code2,Compass,Copy,Download,ExternalLink,Focus,GitBranch,
  Layers3,LocateFixed,Map as MapIcon,MapPin,Menu,Minus,MousePointer2,
  Navigation,Palette,Plus,RotateCcw,Ruler,Search,Settings2,ShieldCheck,
  SlidersHorizontal,Sparkles,Trash2,Upload,X
} from "lucide-react";
import {
  createPhotonGeocoder,formatDistance,haversineKm,
  parseCoordinatePair,pathLengthKm,validPoint,toAtlasGeoJSON,parseAtlasGeoJSON,type LatLng,
  type MarkerData,type Place,type Shape
} from "@atlas/core";
import type {AtlasMapHandle,TileSource,ViewState} from "@atlas/react";
import {
  STYLE_GROUPS,createAtlasPresetDocument,getAtlasPreset,
  getAtlasPresetCoreColors,reskinAtlasPreset,stringifyAtlasStyleDocument,
  applyMapDetailControls,getAtlasPresetDetailSettings,mergeMapDetailOverrides,deriveMapDetailOverrides,
  createAdvancedStyleSettings,applyAdvancedStyleControls,
  type AtlasStyleDocument,type StyleLayerDescriptor,type JsonRecord,type MapDetailOverrides,type AdvancedStyleSettings
} from "@atlas/style-core";
import {PresetGallery} from "./studio/PresetGallery";
import {PaletteEditor} from "./studio/PaletteEditor";
import {LayerEditor} from "./studio/LayerEditor";
import {StudioPresetCache} from "./studio/studioCache";
import {MapDetailPanel} from "./studio/MapDetailPanel";
import {AdvancedRoadPanel,TypographyPanel,ZoomDetailPanel} from "./studio/AdvancedStylePanels";
import {DEFAULT_VECTOR_THEME,KEYLESS_VECTOR_STYLES,preloadVectorStyle,type VectorTheme,type VectorPerformanceEvent} from "@atlas/react/vector-config";
const AtlasVectorMap=lazy(()=>import("./VectorMapLoader"));
const AtlasRasterMap=lazy(()=>import("./RasterMapLoader"));
function warmVectorEngine(){
  // Start fetching the optional engine only when a user shows intent to
  // switch from raster mode. No speculative tile downloads are performed.
  void import("./VectorMapLoader").catch(()=>{});
}


const GUWAHATI:LatLng={lat:26.1716,lng:91.7606};
const osmAttribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
const BASEMAPS:Record<string,TileSource>={
  standard:{url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",attribution:osmAttribution,maxZoom:19}
};
const COLOR_FIELDS:[keyof VectorTheme,string,string][]=[
  ["land","Land / background","Base map land and background color"],
  ["water","Rivers and water","Rivers, lakes and water layers"],
  ["parks","Parks and greenery","Green spaces, woods and landcover"],
  ["roads","Road surfaces","Road lines and transport layers"],
  ["buildings","Buildings","Building fills and outlines"],
  ["labels","Map labels","Map names and text layers"]
];
const INITIAL_PRESET="minimal-light";
const MINIMAL_THEME:VectorTheme=getAtlasPresetCoreColors(INITIAL_PRESET);
function bindingsFor(layers:readonly StyleLayerDescriptor[]):AtlasStyleDocument["bindings"]{
  const bindings:AtlasStyleDocument["bindings"]={};
  for(const group of STYLE_GROUPS){
    const ids=layers.filter(layer=>layer.suggestedGroup===group).map(layer=>layer.id);
    if(ids.length)bindings[group]=ids;
  }
  return bindings;
}
const VECTOR_STYLES=[
  {id:"liberty",name:"Liberty",tag:"Detailed"},
  {id:"positron",name:"Positron",tag:"Minimal"},
  {id:"bright",name:"Bright",tag:"Vibrant"},
  {id:"dark",name:"Dark",tag:"Night"}
] as const;
const INITIAL:MarkerData[]=[
  {id:"sample-1",point:{lat:26.1716,lng:91.7606},title:"Atlas origin",subtitle:"Sample marker",color:"#5365da",draggable:true},
  {id:"sample-2",point:{lat:26.1824,lng:91.7741},title:"Demo waypoint",subtitle:"Draggable test pin",color:"#e98d57",draggable:true},
  {id:"sample-3",point:{lat:26.1561,lng:91.7432},title:"Second waypoint",subtitle:"Draggable test pin",color:"#21a997",draggable:true}
];
const NAV=[
  {id:"explore",label:"Explore map",icon:Compass},
  {id:"markers",label:"Markers",icon:MapPin},
  {id:"draw",label:"Drawing & measure",icon:Ruler},
  {id:"styles",label:"Style studio",icon:Palette},
  {id:"geocode",label:"Geocoding",icon:Search},
  {id:"diagnostics",label:"Diagnostics",icon:Activity}
] as const;
type Tab=typeof NAV[number]["id"];
type Mode="inspect"|"pin"|"line"|"polygon"|"circle"|"measure";
const DRAW_TOOLS:{id:Mode;name:string;hint:string;icon:typeof MapPin}[]=[
  {id:"inspect",name:"Inspect",hint:"Click for a place name",icon:MousePointer2},
  {id:"pin",name:"Drop pin",hint:"Click map to add",icon:MapPin},
  {id:"line",name:"Polyline",hint:"Two or more points",icon:GitBranch},
  {id:"polygon",name:"Polygon",hint:"Three or more points",icon:Layers3},
  {id:"circle",name:"Circle",hint:"Click for centre",icon:Circle},
  {id:"measure",name:"Measure",hint:"Straight-line distance",icon:Ruler}
];
type EventLine={id:number;time:string;text:string};
function coordinateText(p:LatLng){return p.lat.toFixed(5)+", "+p.lng.toFixed(5);}
function readMarkers():MarkerData[]{
  try{
    const raw=localStorage.getItem("atlas.lab.markers");
    if(!raw)return INITIAL;
    const data:unknown=JSON.parse(raw);
    if(!Array.isArray(data))return INITIAL;
    return data.slice(0,300).filter((x):x is MarkerData=>{
      if(!x||typeof x!=="object")return false;
      const m=x as Record<string,unknown>;
      return typeof m.id==="string"&&typeof m.title==="string"&&validPoint(m.point);
    }).map(m=>({...m,title:m.title.slice(0,120),draggable:true}));
  }catch{return INITIAL;}
}
function downloadText(name:string,content:string){
  const blob=new Blob([content],{type:"application/geo+json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function App(){
  const map=useRef<AtlasMapHandle>(null);
  const geocoder=useMemo(()=>createPhotonGeocoder(),[]);
  const [tab,setTab]=useState<Tab>("explore");
  const [mobileMenu,setMobileMenu]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [mode,setMode]=useState<Mode>("inspect");
  const [markers,setMarkers]=useState<MarkerData[]>(readMarkers);
  const [shapes,setShapes]=useState<Shape[]>([]);
  const [draft,setDraft]=useState<LatLng[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [markerColor,setMarkerColor]=useState("#5365da");
  const [circleRadius,setCircleRadius]=useState(350);
  const [renderer,setRenderer]=useState<"vector"|"raster">("vector");
  const [vectorError,setVectorError]=useState<string|null>(null);
  const [vectorStyle,setVectorStyle]=useState<keyof typeof KEYLESS_VECTOR_STYLES>("positron");
  const [quality,setQuality]=useState<"balanced"|"high">("balanced");
  const [adaptiveResolution,setAdaptiveResolution]=useState(true);
  const [resolutionState,setResolutionState]=useState<{phase:"moving"|"idle";pixelRatio:number}|null>(null);
  const [vectorPerformance,setVectorPerformance]=useState<{style?:number;idle?:number}>({});
  const [vectorTheme,setVectorTheme]=useState<VectorTheme>({...MINIMAL_THEME});
  const [studioDocument,setStudioDocument]=useState<AtlasStyleDocument>(()=>createAtlasPresetDocument(INITIAL_PRESET));
  const [activePresetId,setActivePresetId]=useState<string|null>(INITIAL_PRESET);
  const [basePresetId,setBasePresetId]=useState<string>(INITIAL_PRESET);
  const [customPalette,setCustomPalette]=useState<string[]|null>(null);
  const [studioLayers,setStudioLayers]=useState<StyleLayerDescriptor[]>([]);
  const [studioWarnings,setStudioWarnings]=useState<string[]>([]);
  const [detailOverrides,setDetailOverrides]=useState<MapDetailOverrides>(()=>({roads:{},features:{}}));
  const [mapBaseStyle,setMapBaseStyle]=useState<JsonRecord|null>(null);
  const [advancedSettings,setAdvancedSettings]=useState<AdvancedStyleSettings>(()=>createAdvancedStyleSettings());
  const studioCache=useRef(new StudioPresetCache());
  const [preparedPresets,setPreparedPresets]=useState(0);
  const [baseId,setBaseId]=useState("standard");
  const [customUrl,setCustomUrl]=useState("");
  const [customTiles,setCustomTiles]=useState<TileSource|null>(null);
  const [tileFilter,setTileFilter]=useState("none");
  const [showMarkers,setShowMarkers]=useState(true);
  const [showShapes,setShowShapes]=useState(true);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Place[]>([]);
  const [searching,setSearching]=useState(false);
  const [found,setFound]=useState<Place|null>(null);
  const [loadingReverse,setLoadingReverse]=useState(false);
  const [notification,setNotification]=useState("");
  const [view,setView]=useState<ViewState|null>(null);
  const [events,setEvents]=useState<EventLine[]>([]);
  const [diagnosticResult,setDiagnosticResult]=useState<string[]>([]);
  const searchSequence=useRef(0);
  const reverseSequence=useRef(0);
  const importRef=useRef<HTMLInputElement>(null);
  const uid=useRef(20);
  const nextId=()=>String(++uid.current)+"-"+Date.now().toString(36);
  const captureVectorMetric=useCallback((event:VectorPerformanceEvent)=>{
    setVectorPerformance(previous=>({...previous,[event.phase]:event.elapsedMs}));
  },[]);
  const log=useCallback((text:string)=>{
    setEvents(s=>[{id:Date.now()+Math.random(),time:new Date().toLocaleTimeString(),text},...s].slice(0,16));
  },[]);
  const alert=(text:string)=>{setNotification(text);log(text);};
  useEffect(()=>{localStorage.setItem("atlas.lab.markers",JSON.stringify(markers));},[markers]);
  // Atlas Lab only: warm the four small style documents at low priority.
  // MapLibre still owns vector tile/glyph/sprite requests and their browser
  // cache policy; preloading cannot cache the world's geographic data.
  useEffect(()=>{
    for(const url of Object.values(KEYLESS_VECTOR_STYLES))
      preloadVectorStyle(url,"low");
  },[]);
  const presetDetailSettings=useMemo(()=>getAtlasPresetDetailSettings(basePresetId),[basePresetId]);
  const detailSettings=useMemo(()=>mergeMapDetailOverrides(presetDetailSettings,detailOverrides),
    [presetDetailSettings,detailOverrides]);
  const detailStyleDocument=useMemo(()=>applyMapDetailControls(
    studioDocument,studioLayers,detailSettings,mapBaseStyle
  ),[studioDocument,studioLayers,detailSettings,mapBaseStyle]);
  const effectiveStyleDocument=useMemo(()=>applyAdvancedStyleControls(
    detailStyleDocument,studioLayers,advancedSettings,mapBaseStyle
  ),[detailStyleDocument,studioLayers,advancedSettings,mapBaseStyle]);
  const tile=baseId==="custom"&&customTiles ? customTiles : BASEMAPS.standard!;
  const colorsForDocument=(document:AtlasStyleDocument):VectorTheme=>{
    const fallback=getAtlasPresetCoreColors(basePresetId);
    return Object.fromEntries(
      (["land","water","parks","roads","buildings","labels"] as const)
        .map(key=>[key,document.groups[key]?.color??fallback[key]])
    ) as VectorTheme;
  };
  const choosePreset=(id:string)=>{
    const preset=getAtlasPreset(id);
    // Fast Studio mode: retain the current loaded vector source/layers.
    // Choosing a preset changes only its prepared paint/layout overrides.
    // The separate vector base selector remains available when required.
    const document=studioCache.current.get(id,customPalette);
    setActivePresetId(id);
    setBasePresetId(id);
    setStudioWarnings([]);
    setVectorTheme(colorsForDocument(document));
    setStudioDocument(document);
    log("Atlas preset: "+preset.name+(customPalette?" · custom palette":"")+
      " (instant Studio preview)");
  };
  const applyCustomPalette=(colors:string[]|null)=>{
    const base=studioCache.current.get(basePresetId,colors);
    // Custom edits take precedence over generated group styles while the
    // base map remains the same, without remounting or fetching tiles.
    if(colors && studioDocument.baseStyle===vectorStyle){
      base.layers={...base.layers,...studioDocument.layers};
    }
    setCustomPalette(colors);
    setActivePresetId(basePresetId);
    setStudioWarnings([]);
    setVectorTheme(colorsForDocument(base));
    setStudioDocument(base);
    log(colors?"Applied "+colors.length+"-colour palette to "+getAtlasPreset(basePresetId).name:
      "Restored "+getAtlasPreset(basePresetId).name+" original palette");
  };
  const editStudioDocument=(document:AtlasStyleDocument)=>{
    setActivePresetId(null);
    setStudioDocument({...document,id:"custom-theme",name:"Custom theme",
      metadata:{...document.metadata,preset:"custom",derivedFrom:basePresetId}});
  };
  const switchTab=(name:Tab)=>{setTab(name);setMobileMenu(false);};
  const selectMode=(next:Mode)=>{setMode(next);setDraft([]);log("Tool: "+next);};
  const lookup=async(point:LatLng)=>{
    const seq=++reverseSequence.current;
    setLoadingReverse(true);setFound(null);
    try{
      const p=await geocoder.reverse(point);
      if(seq!==reverseSequence.current)return;
      setFound(p??{id:"coordinate",name:"No place name found",point});
      log("Reverse lookup: "+coordinateText(point));
    }catch(e){
      if(seq===reverseSequence.current)alert(e instanceof Error?e.message:"Location lookup failed");
    }finally{if(seq===reverseSequence.current)setLoadingReverse(false);}
  };
  const handleMapClick=(point:LatLng)=>{
    log("Map click: "+coordinateText(point));
    if(mode==="pin"){
      const id=nextId();
      setMarkers(s=>[...s,{id,point,title:"Pin "+(s.length+1),color:markerColor,draggable:true}]);
      setSelected(id);
      return;
    }
    if(mode==="circle"){
      setShapes(s=>[...s,{id:nextId(),kind:"circle",center:point,radiusMeters:circleRadius,color:markerColor,label:"Radius "+circleRadius+" m"}]);
      return;
    }
    if(mode==="line"||mode==="polygon"||mode==="measure"){
      setDraft(s=>[...s,point]);
      return;
    }
    void lookup(point);
  };
  const finishShape=()=>{
    const min=mode==="polygon"?3:2;
    if(draft.length<min){alert("Add at least "+min+" points to finish.");return;}
    const isPolygon=mode==="polygon";
    const length=pathLengthKm(isPolygon?[...draft,draft[0]!]:draft);
    const shape:Shape={id:nextId(),kind:isPolygon?"polygon":"polyline",points:draft,color:markerColor,label:(mode==="measure"?"Measured ":"")+(isPolygon?"Polygon":"Line")+" · "+formatDistance(length)};
    setShapes(s=>[...s,shape]);setDraft([]);
    alert("Created "+(isPolygon?"polygon":"line")+" · "+formatDistance(length));
  };
  const runSearch=async(e?:FormEvent)=>{
    e?.preventDefault();
    const text=query.trim();
    if(!text)return;
    const coords=parseCoordinatePair(text);
    if(coords){map.current?.flyTo(coords,15);setFound({id:"coordinates",name:"Coordinates",point:coords});setResults([]);log("Jumped to "+coordinateText(coords));return;}
    const seq=++searchSequence.current;
    setSearching(true);setResults([]);
    try{
      const places=await geocoder.search(text);
      if(seq===searchSequence.current){setResults(places);if(!places.length)alert("No matching places found.");else log("Search returned "+places.length+" results");}
    }catch(err){if(seq===searchSequence.current)alert(err instanceof Error?err.message:"Search failed");}
    finally{if(seq===searchSequence.current)setSearching(false);}
  };
  const choosePlace=(p:Place)=>{
    setResults([]);setQuery(p.name);setFound(p);
    map.current?.flyTo(p.point,14);
    log("Focused: "+p.name);
  };
  const locate=()=>{
    if(!navigator.geolocation){alert("Geolocation not supported.");return;}
    navigator.geolocation.getCurrentPosition(
      pos=>{
        const point={lat:pos.coords.latitude,lng:pos.coords.longitude};
        map.current?.flyTo(point,15);
        setFound({id:"gps",name:"Your device location",point});
        log("Location permission granted");
      },
      ()=>alert("Location unavailable or permission denied."),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    );
  };
  const copyCoordinates=async(p:LatLng)=>{
    try{await navigator.clipboard.writeText(coordinateText(p));alert("Coordinates copied");}
    catch{alert("Clipboard unavailable; select the coordinates manually.");}
  };
  const exportGeo=()=>{
    downloadText("atlas-lab.geojson",JSON.stringify(toAtlasGeoJSON(markers,shapes),null,2));
    log("Exported GeoJSON via Atlas Core");
  };
  const importGeo=async(file:File)=>{
    if(file.size>2_000_000){alert("GeoJSON file too large (max 2 MB).");return;}
    try{
      const raw:unknown=JSON.parse(await file.text());
      const {markers:pins,shapes:drawn,skipped}=parseAtlasGeoJSON(raw,{
        maxFeatures:250,defaultColor:markerColor,idFactory:()=>nextId()
      });
      setMarkers(s=>[...s,...pins].slice(0,300));
      setShapes(s=>[...s,...drawn].slice(0,300));
      alert("Imported "+pins.length+" pins and "+drawn.length+" shapes."+
        (skipped?" Skipped "+skipped+" invalid or excess features.":""));
      const points=[...pins.map(p=>p.point),...drawn.map(s=>s.kind==="circle"?s.center:s.points[0]!)];
      if(points.length)map.current?.fitTo(points);
    }catch(error){alert(error instanceof Error?error.message:"Invalid GeoJSON file.");}
  };
  const clearAll=()=>{
    if(!window.confirm("Clear all Atlas Lab pins and shapes?"))return;
    setMarkers([]);setShapes([]);setSelected(null);setDraft([]);
    alert("Playground data cleared.");
  };
  const tests=()=>{
    const cases=[
      ["Map initialized",map.current?.getView()!==null],
      ["Coordinate parsing",parseCoordinatePair("26.17, 91.76")?.lat===26.17],
      ["Distance zero",haversineKm(GUWAHATI,GUWAHATI)===0],
      ["Distance calculation",haversineKm({lat:0,lng:0},{lat:1,lng:0})>111],
      ["Markers are valid",markers.every(m=>validPoint(m.point))],
      ["Shape data is valid",shapes.every(s=>s.kind==="circle"?validPoint(s.center):s.points.every(validPoint))],
      ["Tiles configured",tile.url.includes("{z}")&&tile.url.includes("{x}")&&tile.url.includes("{y}")],
      ["Geometry export",toAtlasGeoJSON(markers,shapes).type==="FeatureCollection"]
    ] as const;
    setDiagnosticResult(cases.map(([name,ok])=>(ok?"PASS":"FAIL")+" — "+name));
    alert(cases.filter(([,ok])=>ok).length+"/"+cases.length+" in-browser smoke checks passed");
  };
  const selectedMarker=markers.find(m=>m.id===selected);
  const draftShape=useMemo<Shape[]>(()=>draft.length>=2 && (mode==="line"||mode==="measure"||mode==="polygon")
    ? [{id:"draft",kind:"polyline",points:draft,color:"#ed955a",label:"Drawing in progress"}]:[],[draft,mode]);
  const visibleMarkers=useMemo(()=>showMarkers?markers:[],[showMarkers,markers]);
  const visibleShapes=useMemo(()=>showShapes?[...shapes,...draftShape]:[],[showShapes,shapes,draftShape]);
  const activeItem=NAV.find(n=>n.id===tab)!;
  return <div className="app">
    {mobileMenu&&<button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}/>}
    <aside className={"sidebar"+(collapsed?" sidebar-collapsed":"")+(mobileMenu?" sidebar-open":"")}>
      <div className="brand">
        <div className="brand-mark"><Navigation size={21} strokeWidth={2.4}/></div>
        {!collapsed&&<div className="brand-words"><strong>atlas<span className="brand-period">.</span></strong><small>MAP DEVELOPMENT KIT</small></div>}
        <button className="sidebar-close" aria-label="Close menu" onClick={()=>setMobileMenu(false)}><X size={17}/></button>
      </div>
      {!collapsed&&<div className="workspace-title"><span className="workspace-indicator"/><span>Developer workspace</span><ChevronDown size={14}/></div>}
      <div className="side-section-caption">{!collapsed?"WORKSPACE":"—"}</div>
      <nav className="sidebar-nav" aria-label="Playground areas">
        {NAV.map(n=><button title={n.label} className={"nav-item"+(tab===n.id?" active":"")} key={n.id} onClick={()=>switchTab(n.id)}>
          <n.icon size={19} strokeWidth={tab===n.id?2.4:1.8}/>{!collapsed&&<span>{n.label}</span>}
          {!collapsed&&tab===n.id&&<span className="active-dot"/>}
        </button>)}
      </nav>
      <div className="sidebar-fill"/>
      {!collapsed&&<div className="sidebar-note"><span className="note-icon"><Code2 size={17}/></span><strong>Isolated sandbox</strong><p>Changes here won't touch CivicWatch or Shikshak.</p></div>}
      <button className="sidebar-collapse" onClick={()=>setCollapsed(v=>!v)}><ArrowLeft size={17} style={{transform:collapsed?"rotate(180deg)":undefined}}/>{!collapsed&&"Collapse sidebar"}</button>
      <div className="sidebar-bottom"><span className="version-dot"/>{!collapsed&&<span>Atlas SDK <strong>v0.1.0</strong></span>}</div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu" aria-label="Open menu" onClick={()=>setMobileMenu(true)}><Menu size={21}/></button>
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{activeItem.label}</strong></div>
        </div>
        <div className="topbar-right">
          <span className="live-tag"><span/>LOCAL SANDBOX</span>
          <a className="github-link" href="https://github.com/bhargavkalita47/Atlas" target="_blank" rel="noreferrer"><Code2 size={17}/> <span>Repository</span><ExternalLink size={13}/></a>
        </div>
      </header>
      <div className="content">
        <div className="inspector">
          <div className="inspector-heading">
            <div className="eyebrow">ATLAS / LABORATORY</div>
            <h1>{activeItem.label}</h1>
            <p>{{
              explore:"Explore real places and test the map experience.",
              markers:"Place, drag, select, and manage custom pins.",
              draw:"Draw geometry and measure straight-line distances.",
              styles:"Edit real vector layers with no paid mapping key.",
              geocode:"Inspect forward and reverse geocoding results.",
              diagnostics:"Verify browser capabilities and SDK behavior."
            }[tab]}</p>
          </div>
          <div className="inspector-scroll">
            {tab==="explore"&&<>
              <section className="pane-section"><div className="section-label">QUICK ACTIONS</div>
                <div className="action-list">
                  <button onClick={()=>selectMode("inspect")}><MousePointer2 size={18}/><div><strong>Inspect a location</strong><small>Click anywhere to identify it</small></div><ArrowRight size={16}/></button>
                  <button onClick={locate}><LocateFixed size={18}/><div><strong>Find my position</strong><small>Requires browser permission</small></div><ArrowRight size={16}/></button>
                  <button onClick={()=>{map.current?.setView(GUWAHATI,13);alert("Reset to Guwahati.");}}><Focus size={18}/><div><strong>Reset map view</strong><small>Return to the starting point</small></div><ArrowRight size={16}/></button>
                </div>
              </section>
              <section className="pane-section"><div className="section-label">MAP CONTENT</div>
                <label className="toggle-line"><span><MapPin size={17}/> Visible markers <small>{markers.length} test pins</small></span><input type="checkbox" checked={showMarkers} onChange={e=>setShowMarkers(e.target.checked)}/><i/></label>
                <label className="toggle-line"><span><Layers3 size={17}/> Drawn shapes <small>{shapes.length} geometries</small></span><input type="checkbox" checked={showShapes} onChange={e=>setShowShapes(e.target.checked)}/><i/></label>
              </section>
              <section className="pane-section"><div className="section-label">CURRENT VIEW</div>
                <div className="detail-card">
                  <span>Map centre</span><strong className="mono">{view?coordinateText(view.center):"Initializing…"}</strong>
                  <div className="detail-split"><span>Zoom level <strong>{view?.zoom??"—"}</strong></span><span>Active tool <strong>{mode}</strong></span></div>
                </div>
              </section>
            </>}
            {tab==="markers"&&<>
              <section className="pane-section">
                <div className="section-label">PIN TOOL</div>
                <button className={"primary-button"+(mode==="pin"?" engaged":"")} onClick={()=>selectMode(mode==="pin"?"inspect":"pin")}><Plus size={18}/>{mode==="pin"?"Drop pin active — click map":"Enable drop pin"}</button>
                <div className="field"><label htmlFor="pin-color">Pin color</label><div className="color-input"><input id="pin-color" aria-label="Marker color" type="color" value={markerColor} onChange={e=>setMarkerColor(e.target.value)}/><span className="mono">{markerColor.toUpperCase()}</span></div></div>
              </section>
              <section className="pane-section"><div className="section-heading"><div className="section-label">YOUR PINS · {markers.length}</div><button className="quiet-button" onClick={()=>{setMarkers(INITIAL);setSelected(null);alert("Sample pins restored.");}}>Reset</button></div>
                <div className="marker-list">{markers.length===0?<div className="empty-state">No markers yet. Enable drop pin and click the map.</div>:markers.map(m=>
                  <button className={"marker-row"+(selected===m.id?" selected":"")} key={m.id} onClick={()=>{setSelected(m.id);map.current?.flyTo(m.point,15);}}>
                    <span className="marker-swatch" style={{background:m.color??"#5365da"}}/><span><strong>{m.title}</strong><small>{coordinateText(m.point)}</small></span><ArrowRight size={15}/>
                  </button>)}</div>
              </section>
              {selectedMarker&&<section className="pane-section"><div className="section-label">SELECTED PIN</div>
                <div className="field"><label htmlFor="pin-title">Label</label><input id="pin-title" maxLength={120} value={selectedMarker.title} onChange={e=>setMarkers(s=>s.map(m=>m.id===selected?{...m,title:e.target.value}:m))}/></div>
                <div className="muted-tip">Drag this pin directly on the map to update its coordinates.</div>
                <button className="destructive-button" onClick={()=>{setMarkers(s=>s.filter(m=>m.id!==selected));setSelected(null);}}><Trash2 size={15}/> Remove selected marker</button>
              </section>}
            </>}
            {tab==="draw"&&<>
              <section className="pane-section"><div className="section-label">DRAWING TOOLS</div>
                <div className="tool-grid">{DRAW_TOOLS.filter(t=>["line","polygon","circle","measure","inspect"].includes(t.id)).map(tool=>
                  <button key={tool.id} title={tool.hint} className={"tool-card"+(mode===tool.id?" selected":"")} onClick={()=>selectMode(tool.id)}>
                    <tool.icon size={20}/><strong>{tool.name}</strong><small>{tool.hint}</small>
                  </button>)}</div>
                {mode==="circle"&&<div className="field"><label htmlFor="circle-radius">Circle radius (metres)</label><input id="circle-radius" type="number" min="20" max="100000" value={circleRadius} onChange={e=>setCircleRadius(Math.min(100000,Math.max(20,Number(e.target.value)||20)))}/></div>}
                {draft.length>0&&<div className="draft-box"><strong>{draft.length} vertices placed</strong><span>{formatDistance(pathLengthKm(draft))} direct path</span><div className="inline-actions"><button onClick={()=>setDraft(s=>s.slice(0,-1))}>Undo point</button><button onClick={finishShape}>Finish shape</button></div></div>}
              </section>
              <section className="pane-section"><div className="section-heading"><div className="section-label">DRAWN GEOMETRY · {shapes.length}</div><button className="quiet-button" onClick={()=>setShapes([])}>Clear</button></div>
                {shapes.length===0?<div className="empty-state">Select a drawing tool and click the map to create geometry.</div>:
                shapes.map(s=><div className="shape-row" key={s.id}><div className="shape-symbol" style={{background:s.color+"20",color:s.color}}>{s.kind==="circle"?<Circle size={18}/>:<GitBranch size={18}/>}</div><span><strong>{s.label??s.kind}</strong><small>{s.kind==="circle"?s.radiusMeters+" m radius":s.points.length+" vertices"}</small></span><button aria-label="Delete shape" onClick={()=>setShapes(v=>v.filter(x=>x.id!==s.id))}><Trash2 size={16}/></button></div>)}
              </section>
              <div className="muted-tip">Measurements are spherical straight-line distances, not walking or driving directions.</div>
            </>}
            {tab==="styles"&&<>
              <section className="pane-section"><div className="section-label">RENDER ENGINE</div>
                <div className="filter-options">
                  <button className={renderer==="vector"?"selected":""} onPointerEnter={warmVectorEngine} onFocus={warmVectorEngine} onClick={()=>setRenderer("vector")}>Vector · editable</button>
                  <button className={renderer==="raster"?"selected":""} onClick={()=>setRenderer("raster")}>Raster · fallback</button>
                </div>
                <div className="muted-tip">Vector mode uses MapLibre and keyless OSM-derived tiles. Raster fallback uses standard OpenStreetMap tiles. Neither requires a paid API key.</div>
              </section>
              {renderer==="vector"&&<section className="pane-section">
                <div className="section-label">RENDERING QUALITY</div>
                <div className="filter-options">
                  <button className={quality==="balanced"?"selected":""} onClick={()=>setQuality("balanced")}>Balanced · faster</button>
                  <button className={quality==="high"?"selected":""} onClick={()=>setQuality("high")}>High · sharper</button>
                </div>
                <button className="secondary-button" aria-pressed={adaptiveResolution}
                  onClick={()=>setAdaptiveResolution(value=>!value)}>
                  Dynamic resolution scaling: {adaptiveResolution?"On":"Off"}
                </button>
                <div className="muted-tip">When enabled, Atlas lowers resolution during long mouse drags, restoring quality when movement stops. Touch gestures keep a stable canvas resolution to prevent pinch-zoom freezes. Map detail and tiles stay unchanged.</div>
              </section>}
              {renderer==="vector"&&<>
                <section className="pane-section"><div className="section-label">KEYLESS VECTOR STARTING STYLES</div>
                  <div className="basemap-grid">{VECTOR_STYLES.map(t=><button
                    key={t.id} className={"basemap-card basemap-"+(t.id==="dark"?"dark":"light")+(vectorStyle===t.id?" selected":"")}
                    onPointerEnter={()=>preloadVectorStyle(KEYLESS_VECTOR_STYLES[t.id])}
                    onFocus={()=>preloadVectorStyle(KEYLESS_VECTOR_STYLES[t.id])}
                    onClick={()=>{setActivePresetId(null);setCustomPalette(null);setVectorStyle(t.id);setStudioLayers([]);log("Vector style: "+t.name);}}>
                    <span className="basemap-preview"><span className="road one"/><span className="road two"/><span className="water"/></span>
                    <strong>{t.name}</strong><small>{t.tag}</small>{vectorStyle===t.id&&<Check size={16} className="basemap-check"/>}
                  </button>)}</div>
                  <div className="muted-tip">Hosted by OpenFreeMap, an open-source OSM-derived tile system. No account or key. Self-hosting can be configured later.</div>
                </section>
                <div className="muted-tip" role="status" aria-label="Atlas preset cache status">
                  {preparedPresets>0
                    ?preparedPresets+" presets prepared in memory for "+vectorStyle+" · selecting a theme will not reload tiles."
                    :"Preparing Studio preset cache from the loaded vector map…"}
                  {" "}Changing the vector base above still reloads its distinct provider resources.
                </div>
                <PresetGallery activePresetId={activePresetId} basePresetId={basePresetId}
                  palette={customPalette} onApply={choosePreset}/>
                <PaletteEditor presetId={basePresetId} colors={customPalette}
                  onChange={applyCustomPalette}/>
                <MapDetailPanel layers={studioLayers} settings={detailSettings}
                  presetSettings={presetDetailSettings} presetName={getAtlasPreset(basePresetId).name}
                  onChange={next=>setDetailOverrides(deriveMapDetailOverrides(presetDetailSettings,next))}
                  onReset={()=>setDetailOverrides({roads:{},features:{}})}/>
                <AdvancedRoadPanel settings={advancedSettings} onChange={setAdvancedSettings} baseStyle={mapBaseStyle}/>
                <TypographyPanel settings={advancedSettings} onChange={setAdvancedSettings} baseStyle={mapBaseStyle}/>
                <ZoomDetailPanel settings={advancedSettings} onChange={setAdvancedSettings}
                  currentZoom={view?.zoom??13}
                  onPreviewZoom={zoom=>map.current?.setView(view?.center??GUWAHATI,zoom)}/>
                <section className="pane-section"><div className="section-heading">
                    <div className="section-label">EDIT THEME COLOURS</div>
                    <span className="atlas-layer-count">{activePresetId?getAtlasPreset(activePresetId).name:"Custom"}</span>
                  </div>
                  <div className="vector-color-fields">{COLOR_FIELDS.map(([key,label,description])=><label className="vector-color-row" key={key}>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <input type="color" aria-label={label} value={vectorTheme[key]}
                      onChange={event=>{
                        const color=event.target.value;
                        setVectorTheme(old=>({...old,[key]:color}));
                        editStudioDocument({...studioDocument,groups:{
                          ...studioDocument.groups,[key]:{...studioDocument.groups[key],color}
                        }});
                      }}/>
                  </label>)}</div>
                  <button className="secondary-button" onClick={()=>{
                    downloadText("atlas-style-v2.json",stringifyAtlasStyleDocument(effectiveStyleDocument));
                    log("Exported Atlas style document v2");
                  }}><Download size={16}/> Export editable style JSON (v2)</button>
                  <div className="muted-tip">Presets apply immediately. Changing a colour or individual layer creates a Custom theme without altering the original preset. Layer bindings depend on the loaded vector style.</div>
                </section>
                <LayerEditor layers={studioLayers} document={studioDocument} onChange={editStudioDocument}/>
                {studioWarnings.length>0&&<section className="pane-section"><div className="section-label">STYLE DIAGNOSTICS</div><div className="muted-tip">{studioWarnings.slice(0,3).join(" · ")}</div></section>}
              </>}
              {renderer==="raster"&&<>
                <section className="pane-section"><div className="section-label">RASTER TILE SOURCE</div>
                  <button className={"secondary-button"+(baseId==="standard"?" engaged":"")}
                    onClick={()=>setBaseId("standard")}>Standard OpenStreetMap (no key)</button>
                  <div className="field"><label htmlFor="tile-url">Optional HTTPS raster tile URL</label>
                    <input id="tile-url" placeholder="https://.../{z}/{x}/{y}.png" value={customUrl} onChange={event=>setCustomUrl(event.target.value)}/></div>
                  <button className="secondary-button" onClick={()=>{
                    if(!/^https:\/\//i.test(customUrl)||!["{z}","{x}","{y}"].every(v=>customUrl.includes(v)))
                      return alert("Use an HTTPS URL containing {z}, {x}, and {y}.");
                    setCustomTiles({url:customUrl,attribution:osmAttribution,maxZoom:19});
                    setBaseId("custom");
                    alert("Custom raster tiles applied. Check provider attribution.");
                  }}>Apply custom raster tiles</button>
                </section>
                <section className="pane-section"><div className="section-label">RASTER IMAGE FILTER</div>
                  <div className="filter-options">{[
                    ["none","Original"],["saturate(1.45) contrast(1.08)","Vivid"],
                    ["grayscale(1)","Monochrome"],["sepia(.35) saturate(.8)","Warm"]
                  ].map(([value,name])=><button className={tileFilter===value?"selected":""} key={value}
                    onClick={()=>setTileFilter(value??"none")}>{name}</button>)}</div>
                  <div className="muted-tip">Raster filters are simple image effects; switch to Vector for individually editable map layers.</div>
                </section>
              </>}
            </>}
            {tab==="geocode"&&<>
              <section className="pane-section"><div className="section-label">SEARCH / FORWARD GEOCODING</div>
                <form onSubmit={runSearch} className="sidebar-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="City, neighbourhood or lat,lng"/><button aria-label="Find" type="submit"><ArrowRight size={17}/></button></form>
                <div className="muted-tip">Powered by Photon (OSM data). Submit searches explicitly to respect shared infrastructure.</div>
              </section>
              <section className="pane-section"><div className="section-label">REVERSE GEOCODING</div>
                <button className="secondary-button" onClick={()=>selectMode("inspect")}><MousePointer2 size={16}/> Enable map inspection</button>
                <p className="small-copy">Click anywhere on the map. Atlas queries Photon and uses Nominatim when essential location fields are missing.</p>
                {loadingReverse&&<div className="loading-line">Resolving selected coordinates…</div>}
                {found&&<div className="place-detail"><span>LAST IDENTIFIED PLACE</span><strong>{found.name}</strong><div className="mono">{coordinateText(found.point)}</div>{found.city&&<small>City: {found.city}</small>}{found.locality&&<small>Locality: {found.locality}</small>}<button onClick={()=>void copyCoordinates(found.point)}><Copy size={14}/> Copy coordinates</button></div>}
              </section>
              <div className="muted-tip">Public geocoding endpoints may rate-limit requests or return imperfect administrative boundaries.</div>
            </>}
            {tab==="diagnostics"&&<>
              <section className="pane-section"><div className="section-label">SDK HEALTH CHECK</div>
                <button className="primary-button" onClick={tests}><Activity size={17}/> Run browser smoke checks</button>
                {diagnosticResult.length>0&&<div className="test-results">{diagnosticResult.map(row=><div key={row} className={row.startsWith("PASS")?"passed":"failed"}>{row.startsWith("PASS")?<CheckCircle2 size={16}/>:<X size={16}/>}<span>{row.split(" — ")[1]}</span></div>)}</div>}
              </section>
                            <section className="pane-section"><div className="section-label">VECTOR RENDERER</div>
                <div className="detail-card">
                  <span>Active renderer</span><strong>{renderer==="vector"?"MapLibre GL JS":"Leaflet raster"}</strong>
                  {vectorError&&<div className="muted-tip">Previous vector error: {vectorError}</div>}
                  {vectorPerformance.style!==undefined&&<div className="muted-tip">Vector style ready: {vectorPerformance.style} ms</div>}
                  {vectorPerformance.idle!==undefined&&<div className="muted-tip">Vector fully idle: {vectorPerformance.idle} ms</div>}
                  {renderer==="vector"&&resolutionState&&<div className="muted-tip">Canvas resolution: {resolutionState.pixelRatio.toFixed(2)}× · {resolutionState.phase}</div>}
                </div>
                {renderer==="raster"&&<button className="secondary-button" style={{marginTop:10}} onClick={()=>{
                  setVectorError(null);
                  setRenderer("vector");
                }}>Retry vector map</button>}
              </section>
<section className="pane-section"><div className="section-label">DATA INTERCHANGE</div>
                <div className="button-stack">
                  <button className="secondary-button" onClick={exportGeo}><Download size={17}/> Export GeoJSON</button>
                  <button className="secondary-button" onClick={()=>importRef.current?.click()}><Upload size={17}/> Import GeoJSON</button>
                  <input ref={importRef} type="file" accept=".json,.geojson,application/geo+json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importGeo(file);e.target.value="";}}/>
                  <button className="destructive-button" onClick={clearAll}><Trash2 size={17}/> Clear sandbox data</button>
                </div>
              </section>
              <section className="pane-section"><div className="section-label">LIVE EVENT LOG</div>
                <div className="event-list">{events.length===0?<div className="empty-state">Interact with the map to see SDK events.</div>:events.map(e=><div key={e.id}><span className="mono">{e.time}</span><p>{e.text}</p></div>)}</div>
              </section>
              <div className="muted-tip">Automated core tests run in GitHub CI. Network requests, browser permissions and visual behavior still need manual checks.</div>
            </>}
          </div>
          <div className="inspector-footer"><ShieldCheck size={15}/> No user account or backend required</div>
        </div>
        <main className="map-stage">
          {renderer==="vector"?
            <Suspense fallback={<div className="vector-loading-state" role="status">
              <span className="spinner"/>
              <strong>Starting Atlas vector map</strong>
              <small>Loading the rendering engine…</small>
            </div>}>
            <AtlasVectorMap
              ref={map}
              center={view?.center??GUWAHATI}
              zoom={view?.zoom??13}
              styleUrl={KEYLESS_VECTOR_STYLES[vectorStyle]}
              theme={vectorTheme}
              styleDocument={effectiveStyleDocument}
              onStyleLayers={(layers,baseStyle)=>{
                setMapBaseStyle(baseStyle??null);
                // The inventory is provider-specific. Prepare all 81 Atlas
                // recipes once; subsequent selections use independent copies.
                studioCache.current.prepare(vectorStyle,layers);
                setPreparedPresets(studioCache.current.size);
                setStudioLayers(layers);
                setStudioDocument(old=>{
                  if(activePresetId){
                    return studioCache.current.get(activePresetId,customPalette);
                  }
                  return {...old,baseStyle:vectorStyle,bindings:bindingsFor(layers),
                    layers:old.baseStyle===vectorStyle?old.layers:{}};
                });
              }}
              onStyleDiagnostics={diagnostics=>{
                const relevant=diagnostics.filter(d=>d.severity==="error"||d.code.endsWith("REJECTED"));
                setStudioWarnings(relevant.map(d=>d.code+": "+d.message));
              }}
              renderQuality={quality}
              adaptiveResolution={adaptiveResolution}
              onResolutionChange={setResolutionState}
              onPerformance={captureVectorMetric}
              markers={visibleMarkers}
              shapes={visibleShapes}
              selectedId={selected}
              className="lab-map"
              onClick={handleMapClick}
              onViewChange={setView}
              onSelect={id=>{setSelected(id);log("Selected pin "+id);}}
              onDrag={(id,point)=>{setMarkers(prev=>prev.map(m=>m.id===id?{...m,point}:m));log("Pin moved to "+coordinateText(point));}}
              onReady={()=>{setVectorError(null);log("Vector map ready");}}
              onError={(message)=>{
                setVectorError(message);
                setRenderer("raster");
                alert("Vector renderer unavailable; switched to OSM raster. "+message);
              }}
            />
            </Suspense>
          :<Suspense fallback={<div className="vector-loading-state" role="status">
              <span className="spinner"/>
              <strong>Starting Atlas raster map</strong>
              <small>Loading the lightweight map renderer…</small>
            </div>}>
            <AtlasRasterMap
              ref={map}
              center={view?.center??GUWAHATI}
              zoom={view?.zoom??13}
              tile={tile}
              tileFilter={tileFilter}
              className="lab-map"
              markers={visibleMarkers}
              shapes={visibleShapes}
              selectedId={selected}
              onClick={handleMapClick}
              onViewChange={setView}
              onReady={()=>log("Map ready")}
              onSelect={id=>{setSelected(id);log("Selected pin "+id);}}
              onDrag={(id,point)=>{
                setMarkers(s=>s.map(m=>m.id===id?{...m,point}:m));
                log("Pin moved to "+coordinateText(point));
              }}
            />
          </Suspense>}

          <div className="map-search-wrap">
            <form className="map-search" onSubmit={runSearch}>
              <Search size={21} strokeWidth={2}/><input value={query} onChange={e=>{setQuery(e.target.value);setResults([]);}} aria-label="Search places or coordinates" placeholder="Search places or paste coordinates…" />
              {query&&<button aria-label="Clear search" type="button" className="search-clear" onClick={()=>{setQuery("");setResults([]);}}><X size={16}/></button>}
              <button className="search-submit" aria-label="Search" type="submit">{searching?<span className="spinner"/>:<ArrowRight size={19}/>}</button>
            </form>
            {results.length>0&&<div className="search-results">{results.map(r=><button key={r.id} onClick={()=>choosePlace(r)}><MapPin size={17}/><span>{r.name}</span><ArrowRight size={15}/></button>)}</div>}
          </div>
          <div className="map-top-right">
            <span className="map-provider-label"><span className="online-dot"/> {renderer==="vector"?"KEYLESS VECTOR":"OSM RASTER"}</span>
            <button title="Map layers" onClick={()=>switchTab("styles")}><Layers3 size={19}/></button>
          </div>
          <div className="map-actions">
            <button title="Zoom in" aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={20}/></button>
            <button title="Zoom out" aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><Minus size={20}/></button>
            <span className="map-action-divider"/>
            <button title="Locate" aria-label="Find my location" onClick={locate}><LocateFixed size={19}/></button>
            <button title="Fit pins" aria-label="Fit all markers" onClick={()=>map.current?.fitTo(markers.map(m=>m.point))}><Focus size={19}/></button>
          </div>
          <div className="map-bottom-card">
            <div className="map-bottom-icon"><MousePointer2 size={17}/></div>
            <div><strong>{mode==="inspect"?"Map inspection":DRAW_TOOLS.find(t=>t.id===mode)?.name+" mode"}</strong><span>{mode==="inspect"?"Click any location to identify it":mode==="pin"?"Click to place a draggable pin":mode==="circle"?"Click to draw a circle":"Click to add points to the drawing"}</span></div>
            {mode!=="inspect"&&<button onClick={()=>selectMode("inspect")} aria-label="Exit current tool"><X size={17}/></button>}
          </div>
          <div className="map-footer-data">
            <span>{view?coordinateText(view.center):"Loading position…"}</span><span className="footer-pill">Z{view?.zoom??"—"}</span>
            <button title="Copy center coordinates" onClick={()=>view&&void copyCoordinates(view.center)}><Copy size={14}/></button>
          </div>
          {notification&&<div className="toast" role="status"><span>{notification}</span><button aria-label="Dismiss" onClick={()=>setNotification("")}><X size={15}/></button></div>}
          {selectedMarker&&tab==="markers"&&<div className="selected-map-card"><span className="selected-map-icon" style={{background:selectedMarker.color}}><MapPin size={18}/></span><div><strong>{selectedMarker.title}</strong><small>{coordinateText(selectedMarker.point)}</small></div><button onClick={()=>setSelected(null)} aria-label="Unselect marker"><X size={16}/></button></div>}
          {found&&mode==="inspect"&&tab!=="geocode"&&<div className="identified-bubble"><MapPin size={17}/><div><strong>{loadingReverse?"Looking up location…":found.name}</strong><small>{coordinateText(found.point)}</small></div><button title="Dismiss" onClick={()=>setFound(null)}><X size={15}/></button></div>}
          {mode!=="inspect"&&<div className="mode-indicator"><span className="mode-pulse"/> {mode==="pin"?"Click to add a pin":mode==="circle"?"Click to place a circle":draft.length+" points in progress"} {(mode==="line"||mode==="polygon"||mode==="measure")&&draft.length>1&&<button onClick={finishShape}>Finish</button>}</div>}
        </main>
      </div>
    </div>
  </div>;
}
