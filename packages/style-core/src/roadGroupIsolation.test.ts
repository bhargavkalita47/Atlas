import {describe,expect,it} from "vitest";
import {ROAD_PROVIDER_FIXTURES} from "./roadProviderFixtures";
import {
 ROAD_TIERS,ROAD_CONTROL_GROUPS,ROAD_GROUP_TIERS,ROAD_CLASS_VALUES,
 roadTierForClass,roadGroupForClass,roadClassesInFilter,
 classifyRoadLayer,isNonRoadLine,createMapDetailSettings,applyMapDetailControls
} from "./detailControls";
import {createAdvancedStyleSettings,applyAdvancedStyleControls} from "./advancedStyle";
import {createEmptyStyleDocument,compileAtlasStyle,inspectStyleLayers,validateStyleDocument} from "./index";

type Layer={
 id:string;type:string;filter?:unknown;paint?:Record<string,unknown>;
 minzoom?:number;maxzoom?:number
};
const props=(style:Record<string,unknown>,id:string):Layer=>
 (style.layers as unknown as Layer[]).find(l=>l.id===id)!;
function evaluate(value:unknown,roadClass:string,zoom=14):unknown{
 if(!Array.isArray(value))return value;
 const [op,...args]=value;
 if(op==="literal")return args[0];
 if(op==="zoom")return zoom;
 if(op==="get")return args[0]==="class"?roadClass:undefined;
 if(op==="coalesce")return args.map(x=>evaluate(x,roadClass,zoom)).find(x=>x!==null&&x!==undefined);
 if(op==="to-string")return String(evaluate(args[0],roadClass,zoom)??"");
 if(op==="*")return args.reduce((p:unknown,x:unknown)=>Number(p)*Number(evaluate(x,roadClass,zoom)),1);
 if(op==="match"){
   const input=evaluate(args[0],roadClass,zoom);
   for(let i=1;i+1<args.length;i+=2){
     const selector=args[i];
     if(Array.isArray(selector)?selector.includes(input):selector===input)
       return evaluate(args[i+1],roadClass,zoom);
   }
   return evaluate(args[args.length-1],roadClass,zoom);
 }
 if(op==="step"){
   const current=Number(evaluate(args[0],roadClass,zoom));
   let result=args[1];
   for(let i=2;i<args.length;i+=2)if(current>=Number(args[i]))result=args[i+1];
   return evaluate(result,roadClass,zoom);
 }
 if(op==="interpolate"){
   const current=Number(evaluate(args[1],roadClass,zoom));
   const points= args.slice(2);
   const stops:Array<{z:number;value:unknown}>=[];
   for(let i=0;i<points.length;i+=2)stops.push({z:Number(points[i]),value:points[i+1]});
   if(current<=stops[0]!.z)return evaluate(stops[0]!.value,roadClass,zoom);
   for(let i=0;i<stops.length-1;i++){
     if(current<=stops[i+1]!.z){
       const lo=Number(evaluate(stops[i]!.value,roadClass,zoom));
       const hi=Number(evaluate(stops[i+1]!.value,roadClass,zoom));
       if(Number.isFinite(lo)&&Number.isFinite(hi))return lo+(hi-lo)*(current-stops[i]!.z)/(stops[i+1]!.z-stops[i]!.z);
       return evaluate(stops[i]!.value,roadClass,zoom);
     }
   }
   return evaluate(stops[stops.length-1]!.value,roadClass,zoom);
 }
 return value;
}
const compile=(base:unknown,settings:ReturnType<typeof createMapDetailSettings>)=>{
 const layers=inspectStyleLayers(base);
 const doc=applyMapDetailControls(createEmptyStyleDocument("road-audit","dark"),layers,settings,base);
 expect(validateStyleDocument(doc)).toEqual([]);
 return compileAtlasStyle(base,doc).style;
};
describe("Primary/Secondary road group audit against OpenFreeMap",()=>{
 it("defines exactly one mutually exclusive owner for every known OSM driving class",()=>{
   const seen=new Set<string>();
   for(const tier of ROAD_TIERS)for(const roadClass of ROAD_CLASS_VALUES[tier]){
     expect(seen.has(roadClass),roadClass+" appears in two tiers").toBe(false);
     seen.add(roadClass);
     expect(roadTierForClass(roadClass)).toBe(tier);
     const expected=ROAD_CONTROL_GROUPS.find(g=>ROAD_GROUP_TIERS[g].includes(tier));
     expect(roadGroupForClass(roadClass)).toBe(expected);
   }
   expect(roadGroupForClass("primary")).toBe("primaryRoads");
   expect(roadGroupForClass("secondary")).toBe("primaryRoads");
   expect(roadGroupForClass("tertiary")).toBe("secondaryRoads");
   for(const c of ["residential","minor","service","track","street","street_limited"])
     expect(roadGroupForClass(c)).toBe("secondaryRoads");
   expect(roadGroupForClass("path")).toBe("paths");
   expect(roadGroupForClass("rail")).toBeNull();
 });
 it("audits all filtered road layers in the Dark, Positron, Bright and Liberty providers",()=>{
   for(const [name,base] of Object.entries(ROAD_PROVIDER_FIXTURES)){
     const inventory=inspectStyleLayers(base);
     let checked=0,mixed=0,roads=0;
     for(const layer of inventory.filter(l=>l.type==="line")){
       const raw=base.layers.find(x=>x.id===layer.id)!;
       const scopes=roadClassesInFilter(raw.filter);
       if(isNonRoadLine(layer,raw)){
         expect(classifyRoadLayer(layer,raw),name+" "+layer.id).toBeNull();
         continue;
       }
       roads++;
       if(scopes!==null){
         checked++;
         const classes=scopes.map(roadTierForClass);
         const expected=classes.length&&classes.every(x=>x!==null&&x===classes[0])
           ?classes[0]:null;
         expect(classifyRoadLayer(layer,raw),name+" "+layer.id).toBe(expected);
         if(new Set(classes).size>1)mixed++;
       }
     }
     expect(roads,name+" must have roads").toBeGreaterThan(5);
     expect(checked,name+" must include class-filtered roads").toBeGreaterThan(5);
     if(name==="dark"||name==="positron")expect(mixed).toBeGreaterThan(0);
   }
 });
 it("a Primary opacity edit never changes Secondary or path features inside a shared road layer",()=>{
   for(const provider of ["dark","positron"] as const){
     const base=ROAD_PROVIDER_FIXTURES[provider];
     const original=compile(base,createMapDetailSettings());
     const primary=createMapDetailSettings();
     for(const tier of ROAD_GROUP_TIERS.primaryRoads)primary.roads[tier]=23;
     const changed=compile(base,primary);
     const id="highway_major_inner";
     for(const cls of ["primary","secondary","trunk"]){
       const before=evaluate(props(original,id).paint?.["line-opacity"]??1,cls);
       const after=evaluate(props(changed,id).paint?.["line-opacity"]??1,cls);
       expect(Number(after),provider+" "+cls).toBeCloseTo(Number(before)*.23,4);
     }
     for(const cls of ["tertiary","minor","service"]){
       const relevant=cls==="tertiary"?id:"highway_minor";
       const before=evaluate(props(original,relevant).paint?.["line-opacity"]??1,cls);
       const after=evaluate(props(changed,relevant).paint?.["line-opacity"]??1,cls);
       expect(after,provider+" "+cls+" should not change").toEqual(before);
     }
   }
 });
 it("a Secondary opacity edit changes residential/bylanes but leaves main roads untouched",()=>{
   for(const provider of ["dark","positron"] as const){
     const base=ROAD_PROVIDER_FIXTURES[provider];
     const original=compile(base,createMapDetailSettings());
     const secondary=createMapDetailSettings();
     for(const tier of ROAD_GROUP_TIERS.secondaryRoads)secondary.roads[tier]=0;
     const changed=compile(base,secondary);
     for(const cls of ["primary","secondary","trunk"]){
       expect(evaluate(props(changed,"highway_major_inner").paint?.["line-opacity"]??1,cls))
         .toEqual(evaluate(props(original,"highway_major_inner").paint?.["line-opacity"]??1,cls));
     }
     for(const cls of ["minor","service","track"]){
       expect(evaluate(props(changed,"highway_minor").paint?.["line-opacity"]??1,cls)).toBe(0);
     }
     expect(evaluate(props(changed,"highway_major_inner").paint?.["line-opacity"]??1,"tertiary")).toBe(0);
     expect(evaluate(props(changed,"highway_path").paint?.["line-opacity"]??1,"path"))
       .toEqual(evaluate(props(original,"highway_path").paint?.["line-opacity"]??1,"path"));
   }
 });
 it("advanced group colours and widths stay isolated even on mixed provider casing layers",()=>{
   for(const provider of ["dark","positron"] as const){
     const base=ROAD_PROVIDER_FIXTURES[provider];
     const layers=inspectStyleLayers(base);
     const inherited=createAdvancedStyleSettings();
     const editPrimary=createAdvancedStyleSettings();
     for(const tier of ROAD_GROUP_TIERS.primaryRoads){
       editPrimary.roads[tier].color="#A84221";
       editPrimary.roads[tier].width=7;
       editPrimary.roads[tier].outlineColor="#6D330B";
     }
     const before=compileAtlasStyle(base,applyAdvancedStyleControls(
       createEmptyStyleDocument("audit","dark"),layers,inherited,base)).style;
     const after=compileAtlasStyle(base,applyAdvancedStyleControls(
       createEmptyStyleDocument("audit","dark"),layers,editPrimary,base)).style;
     for(const cls of ["primary","secondary","trunk"]){
       expect(evaluate(props(after,"highway_major_inner").paint?.["line-color"],cls)).toBe("#A84221");
       expect(Number(evaluate(props(after,"highway_major_inner").paint?.["line-width"],cls,20))).toBe(7);
     }
     const third="tertiary";
     for(const key of ["line-color","line-width"]){
       const b=evaluate(props(before,"highway_major_inner").paint?.[key],third,20);
       const a=evaluate(props(after,"highway_major_inner").paint?.[key],third,20);
       expect(a,provider+" "+key+" tertiary remains untouched").toEqual(b);
     }
     expect(evaluate(props(after,"highway_major_casing").paint?.["line-color"],"tertiary"))
       .toEqual(evaluate(props(before,"highway_major_casing").paint?.["line-color"],"tertiary"));
     expect(evaluate(props(after,"highway_major_casing").paint?.["line-color"],"primary")).toBe("#6D330B");
   }
 });
});
