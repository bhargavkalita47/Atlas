import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test,expect} from "@playwright/test";

// An in-memory style with a GeoJSON source deliberately exercises MapLibre's
// worker while keeping CI independent of external map tile availability.
const fixtureStyle={
  version:8,
  name:"Atlas deterministic CI style",
  sources:{
    fixture:{
      type:"geojson",
      data:{
        type:"FeatureCollection",
        features:[{
          type:"Feature",
          geometry:{type:"Point",coordinates:[91.7606,26.1716]},
          properties:{name:"Atlas fixture"}
        }]
      }
    }
  },
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#e4e9ef"}},
    {id:"fixture-dot",type:"circle",source:"fixture",paint:{"circle-color":"#6477d4","circle-radius":5}}
  ]
};

test.beforeEach(async({page})=>{
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    await route.fulfill({
      status:200,
      contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},
      body:JSON.stringify(fixtureStyle)
    });
  });
});

test("deploy output caches only fingerprinted assets and preloads default style",async({page})=>{
  const rules=readFileSync(resolve(process.cwd(),"apps/playground/dist/_headers"),"utf8");
  expect(rules).toContain("/assets/*");
  expect(rules).toContain("Cache-Control: public, max-age=31536000, immutable");
  expect(rules).not.toContain("/*\\n  Cache-Control: public, max-age=31536000");

  await page.goto("/");
  // Production HTML hints at the hashed default vector module, not raster.
  await expect(page.locator('link[rel="modulepreload"][href*="VectorMapLoader-"][href$=".js"]')).toHaveCount(1);
  await expect(page.locator('link[rel="modulepreload"][href*="RasterMapLoader-"]')).toHaveCount(0);
  await expect(page.locator('link[rel="preload"][as="fetch"][href="https://tiles.openfreemap.org/styles/positron"]')).toHaveCount(1);
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("button",{name:/Bright/}).hover();
  await expect(page.locator('link[rel="preload"][as="fetch"][href="https://tiles.openfreemap.org/styles/bright"]')).toHaveCount(1);
  await page.getByRole("button",{name:/Bright/}).hover();
  await expect(page.locator('link[rel="preload"][as="fetch"][href="https://tiles.openfreemap.org/styles/bright"]')).toHaveCount(1);
});

test("vector map initializes a worker, renders pins, and applies a new style",async({page})=>{
  const errors:string[]=[];
  page.on("console",entry=>{
    if(entry.type()==="error" && /worker|webgl/i.test(entry.text()))errors.push(entry.text());
  });
  page.on("pageerror",error=>{
    if(/worker|webgl/i.test(error.message))errors.push(error.message);
  });

  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
  // Loading the default vector view must not fetch the optional Leaflet chunk.
  const startResources=await page.evaluate(()=>
    performance.getEntriesByType("resource").map(resource=>resource.name)
  );
  expect(startResources.some(url=>/RasterMapLoader-[^/]+\.(js|css)/.test(url))).toBe(false);

  await page.getByRole("button",{name:"Diagnostics"}).click();
  await expect(page.getByText("Vector map ready")).toBeVisible();
  await expect(page.getByText("MapLibre GL JS")).toBeVisible();
  await expect(page.getByText(/Vector style ready:/)).toBeVisible();

  await page.getByRole("button",{name:"Run browser smoke checks"}).click();
  await expect(page.getByText("Geometry export")).toBeVisible();
  await expect(page.locator(".test-results .failed")).toHaveCount(0);
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("button",{name:/Bright/}).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.locator('input[aria-label="Rivers and water"]').fill("#aabbcc");
  await page.getByRole("button",{name:/High.*sharper/}).click();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await page.getByRole("button",{name:/Balanced.*faster/}).click();

  await page.waitForTimeout(800);
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("maps remain operable on a mobile viewport and can use raster fallback",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("button",{name:/Raster.*fallback/}).click();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
});

test.describe("zoom-safe adaptive resolution on dense displays",()=>{
  test.use({deviceScaleFactor:2});

  test("fast alternating zoom does not resize the WebGL canvas",async({page})=>{
    await page.goto("/");
    const canvas=page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    const pixelRatio=()=>canvas.evaluate(element=>{
      const drawing=element as HTMLCanvasElement;
      return drawing.clientWidth>0?drawing.width/drawing.clientWidth:0;
    });
    await expect.poll(pixelRatio,{timeout:10000}).toBeGreaterThan(1.4);

    await page.evaluate(()=>{
      const target=document.querySelector<HTMLCanvasElement>(".maplibregl-canvas")!;
      const widths:number[]=[];
      Object.assign(window,{atlasZoomTestCanvasWidths:widths});
      new MutationObserver(()=>{
        widths.push(target.width);
      }).observe(target,{attributes:true,attributeFilter:["width","height"]});
    });
    for(let index=0;index<8;index++){
      await page.getByRole("button",{name:index%2===0?"Zoom in":"Zoom out"}).click();
    }
    await page.waitForTimeout(650);
    const widths=await page.evaluate(
      ()=>(window as Window & {atlasZoomTestCanvasWidths:number[]}).atlasZoomTestCanvasWidths
    );
    expect(widths).toEqual([]);
    expect(await pixelRatio()).toBeGreaterThan(1.4);
    await expect(canvas).toBeVisible();
  });

  test("sustained panning reduces resolution and restores it after release",async({page})=>{
    await page.goto("/");
    const canvas=page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    const pixelRatio=()=>canvas.evaluate(element=>{
      const drawing=element as HTMLCanvasElement;
      return drawing.clientWidth>0?drawing.width/drawing.clientWidth:0;
    });
    await expect.poll(pixelRatio,{timeout:10000}).toBeGreaterThan(1.4);
    const bounds=await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const x=bounds!.x+bounds!.width/2;
    const y=bounds!.y+bounds!.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+90,y+45,{steps:10});
    await expect.poll(pixelRatio,{timeout:3500}).toBeLessThan(1.2);
    await page.mouse.up();
    await expect.poll(pixelRatio,{timeout:5000}).toBeGreaterThan(1.4);
    await page.getByRole("button",{name:"Style studio"}).click();
    await page.getByRole("button",{name:"Dynamic resolution scaling: On"}).click();
    await expect(page.getByRole("button",{name:"Dynamic resolution scaling: Off"})).toBeVisible();
    await expect(canvas).toBeVisible();
  });
});
