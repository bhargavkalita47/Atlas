import {describe,expect,it,vi} from "vitest";
import {createPhotonGeocoder} from "./index";
const result=(data:unknown)=>({ok:true,json:async()=>data} as Response);
const feature=(lat:number,lng:number,props:Record<string,unknown>)=>({
  type:"Feature",properties:props,geometry:{coordinates:[lng,lat]},
});
describe("Photon adapter",()=>{
  it("uses longitude/latitude order correctly and caches repeated searches",async()=>{
    const mocked=vi.fn(async()=>result({features:[
      feature(26.18,91.77,{name:"Guwahati",city:"Guwahati",country:"India",osm_type:"N",osm_id:2}),
    ]})) as unknown as typeof fetch;
    const adapter=createPhotonGeocoder({fetcher:mocked,minGapMs:0});
    const a=await adapter.search("Guwahati");
    const b=await adapter.search("Guwahati");
    expect(a[0]?.point).toEqual({lat:26.18,lng:91.77});
    expect(b).toEqual(a);
    expect(mocked).toHaveBeenCalledTimes(1);
  });
  it("rejects too-short queries without network traffic",async()=>{
    const mocked=vi.fn() as unknown as typeof fetch;
    const adapter=createPhotonGeocoder({fetcher:mocked,minGapMs:0});
    await expect(adapter.search("X")).rejects.toThrow("at least 3");
    expect(mocked).not.toHaveBeenCalled();
  });
  it("supplements missing locality from reverse Nominatim fallback",async()=>{
    const mocked=vi.fn(async(url:string)=>{
      if(url.includes("/reverse")&&url.includes("photon"))return result({features:[
        feature(26.18,91.77,{name:"Guwahati",city:"Guwahati",country:"India",osm_type:"N",osm_id:2})
      ]});
      return result({address:{city:"Guwahati",suburb:"Zoo Road",country:"India"},display_name:"Zoo Road, Guwahati"});
    }) as unknown as typeof fetch;
    const adapter=createPhotonGeocoder({fetcher:mocked,minGapMs:0});
    const a=await adapter.reverse({lat:26.18,lng:91.77});
    expect(a?.city).toBe("Guwahati");
    expect(a?.locality).toBe("Zoo Road");
    expect(mocked).toHaveBeenCalledTimes(2);
  });
  it("does not hide geocoder 429 errors",async()=>{
    const mocked=vi.fn(async()=>({ok:false,status:429} as Response)) as unknown as typeof fetch;
    const adapter=createPhotonGeocoder({fetcher:mocked,minGapMs:0});
    await expect(adapter.search("Guwahati")).rejects.toThrow("rate limited");
  });
});
