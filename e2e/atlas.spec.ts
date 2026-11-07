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

test.describe("mobile multi-touch regression",()=>{
  test.use({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true});

  test("pinch, hold two fingers stationary, then pinch again without freezing",async({page})=>{
    await page.goto("/");
    const canvas=page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);

    const bounds=await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const x=Math.round(bounds!.x+bounds!.width/2);
    const y=Math.round(bounds!.y+bounds!.height*.55);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
    const points=(spread:number)=>[
      {x:x-spread,y,id:1},{x:x+spread,y,id:2}
    ];
    const dispatch=(type:"touchStart"|"touchMove"|"touchEnd",spread=0)=>
      cdp.send("Input.dispatchTouchEvent",{
        type,touchPoints:type==="touchEnd"?[]:points(spread)
      });
    const ratio=()=>canvas.evaluate(element=>{
      const value=element as HTMLCanvasElement;
      return value.clientWidth?value.width/value.clientWidth:0;
    });
    const zoom=async()=>{
      const value=await page.locator(".footer-pill").textContent();
      return Number(value?.replace(/^Z/,""));
    };
    const initialRatio=await ratio();
    const initialZoom=await zoom();
    expect(initialRatio).toBeGreaterThan(1.4);

    await dispatch("touchStart",35);
    for(const spread of [45,55,65,75,85,95]){
      await dispatch("touchMove",spread);
      await page.waitForTimeout(25);
    }
    // This is the reported freeze: MapLibre may report moveend/zoomend
    // while both fingers remain on the glass. Canvas must not be resized.
    await page.waitForTimeout(1000);
    expect(await ratio()).toBeCloseTo(initialRatio,1);
    await dispatch("touchMove",110);
    await page.waitForTimeout(100);
    expect(await ratio()).toBeCloseTo(initialRatio,1);
    await dispatch("touchEnd");

    await expect.poll(zoom,{timeout:5000}).toBeGreaterThan(initialZoom+.1);
    const firstZoom=await zoom();

    // Another pinch must still affect the map after the first held gesture.
    await dispatch("touchStart",40);
    for(const spread of [50,60,70,80,90]){
      await dispatch("touchMove",spread);
      await page.waitForTimeout(25);
    }
    await dispatch("touchEnd");
    await expect.poll(zoom,{timeout:5000}).toBeGreaterThan(firstZoom+.1);
    expect(await ratio()).toBeCloseTo(initialRatio,1);
    await cdp.detach();
  });
});

test("style studio edits an exact vector layer and resets without remounting",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.getByText(/EDITABLE MAP LAYERS/)).toBeVisible();
  await page.getByRole("button",{name:/fixture-dot/}).click();
  await page.locator('input[aria-label="Layer color"]').fill("#224466");
  await expect(page.getByText("1 overridden")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
  await page.getByRole("button",{name:"Reset selected layer"}).click();
  await expect(page.getByText("0 overridden")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
});

test("preset gallery applies, customizes and resets themes without a new canvas",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.evaluate(()=>{
    (window as Window & {atlasOriginalCanvas?:Element|null}).atlasOriginalCanvas=document.querySelector(".maplibregl-canvas");
  });
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.getByRole("button",{name:"Apply Minimal Light preset"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Apply Paper & Ink preset"}).click();
  await expect(page.getByRole("button",{name:"Apply Paper & Ink preset"})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('input[aria-label="Land / background"]')).toHaveValue("#f5f0e4");
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
  await page.locator('input[aria-label="Rivers and water"]').fill("#123456");
  await expect(page.getByText("Custom theme",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Apply Paper & Ink preset"})).toHaveAttribute("aria-pressed","false");
  await page.getByRole("button",{name:"Apply Paper & Ink preset"}).click();
  await expect(page.locator('input[aria-label="Rivers and water"]')).toHaveValue("#bfd9dd");
  await page.getByRole("button",{name:"Apply Blueprint preset"}).click();
  await expect(page.getByRole("button",{name:"Apply Blueprint preset"})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  const sameCanvas=await page.evaluate(()=>
    document.querySelector(".maplibregl-canvas")===(window as Window & {atlasOriginalCanvas?:Element|null}).atlasOriginalCanvas
  );
  expect(sameCanvas).toBe(true);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("palette generator reskins any selected preset, retains camera and restores base",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.evaluate(()=>{
    (window as Window & {atlasPaletteTestCanvas?:Element|null}).atlasPaletteTestCanvas=document.querySelector(".maplibregl-canvas");
  });
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.locator(".atlas-preset-total")).toContainText(/\d+ themes/);
  await page.getByRole("button",{name:"Enable custom palette"}).click();
  await expect(page.getByRole("group",{name:"Custom palette swatches"}).locator('input[type="color"]')).toHaveCount(5);
  await page.locator('input[aria-label="Palette colour 2"]').fill("#1469BC");
  await expect(page.getByText("10 outputs")).toBeVisible();
  const previous=await page.locator('input[aria-label="Land / background"]').inputValue();
  await page.getByRole("button",{name:"Apply Paper & Ink preset"}).click();
  await expect(page.getByRole("button",{name:"Apply Paper & Ink preset"})).toHaveAttribute("aria-pressed","true");
  await expect(page.locator('input[aria-label="Palette colour 2"]')).toHaveValue("#1469bc");
  const after=await page.locator('input[aria-label="Land / background"]').inputValue();
  expect(after).not.toBe(previous);
  await page.getByRole("button",{name:"Restore preset colours"}).click();
  await expect(page.getByRole("button",{name:"Enable custom palette"})).toBeVisible();
  await expect(page.locator('input[aria-label="Land / background"]')).toHaveValue("#f5f0e4");
  const same=await page.evaluate(()=>
    document.querySelector(".maplibregl-canvas")===(window as Window & {atlasPaletteTestCanvas?:Element|null}).atlasPaletteTestCanvas
  );
  expect(same).toBe(true);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("preset catalog is searchable and paste accepts 4-6 colours",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("button",{name:"Futuristic"}).click();
  await expect(page.getByRole("button",{name:"Apply Synthwave preset"})).toBeVisible();
  await page.getByRole("button",{name:"All",exact:true}).click();
  await page.locator('input[aria-label="Search map presets"]').fill("sahara");
  await expect(page.getByRole("button",{name:"Apply Sahara Trek preset"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Apply Paper & Ink preset"})).toHaveCount(0);
  await page.locator('input[aria-label="Search map presets"]').fill("");
  await page.locator('textarea[aria-label="Paste palette colours"]').fill("#112233, #AABBCC, #448855, #F5DCA4");
  await page.getByRole("button",{name:"Apply 4–6 colours"}).click();
  await expect(page.getByRole("group",{name:"Custom palette swatches"}).locator('input[type="color"]')).toHaveCount(4);
  await page.getByRole("button",{name:/Add colour/}).click();
  await expect(page.getByRole("group",{name:"Custom palette swatches"}).locator('input[type="color"]')).toHaveCount(5);
  await page.getByRole("button",{name:/Add colour/}).click();
  await expect(page.getByRole("group",{name:"Custom palette swatches"}).locator('input[type="color"]')).toHaveCount(6);
  await expect(page.getByRole("button",{name:/Add colour/})).toBeDisabled();
});

test("warm Atlas Studio presets switch across base recipes without style reload",async({page})=>{
  let styleRequests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    styleRequests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.getByRole("status",{name:"Atlas preset cache status"})).toContainText("81 presets prepared in memory");
  await page.evaluate(()=>{(window as Window & {atlasCachedCanvas?:Element|null}).atlasCachedCanvas=document.querySelector(".maplibregl-canvas");});
  await page.waitForLoadState("networkidle");
  const before=styleRequests;
  // Originally Blueprint was mapped to the Dark provider style, Terra to
  // Liberty. Studio must keep Positron loaded and use incremental paint.
  await page.getByRole("button",{name:"Apply Blueprint preset"}).click();
  await expect(page.getByRole("button",{name:"Apply Blueprint preset"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Apply Terra preset"}).click();
  await expect(page.getByRole("button",{name:"Apply Terra preset"})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Use Neon palette"}).click();
  await page.locator('input[aria-label="Palette colour 1"]').fill("#112233");
  await page.getByRole("button",{name:"Apply Minimal Light preset"}).click();
  await expect(page.locator('input[aria-label="Palette colour 1"]')).toHaveValue("#112233");
  expect(styleRequests).toBe(before);
  expect(await page.evaluate(()=>document.querySelector(".maplibregl-canvas")===(window as Window & {atlasCachedCanvas?:Element|null}).atlasCachedCanvas)).toBe(true);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("map detail panel supports per-road opacity and feature visibility without style reload",async({page})=>{
  let styleRequests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    styleRequests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.getByRole("group",{name:"Map detail density"})).toBeVisible();
  await page.evaluate(()=>{(window as Window & {atlasDetailCanvas?:Element|null}).atlasDetailCanvas=document.querySelector(".maplibregl-canvas");});
  await page.waitForLoadState("networkidle");
  const originalRequests=styleRequests;
  await page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]').fill("25");
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]')).toHaveValue("25");
  await page.getByRole("combobox",{name:"Buildings visibility"}).selectOption("hide");
  await expect(page.getByRole("combobox",{name:"Buildings visibility"})).toHaveValue("hide");
  await page.getByRole("button",{name:"Apply Paper & Ink preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]')).toHaveValue("25");
  await expect(page.getByRole("combobox",{name:"Buildings visibility"})).toHaveValue("hide");
  await page.getByRole("button",{name:"Essential",exact:true}).click();
  await expect(page.locator('input[aria-label="Neighbourhood roads (Secondary) opacity"]')).toHaveValue("0");
  await page.getByRole("button",{name:"Reset to preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]')).toHaveValue("82");
  await expect(page.getByRole("combobox",{name:"Buildings visibility"})).toHaveValue("inherit");
  expect(styleRequests).toBe(originalRequests);
  expect(await page.evaluate(()=>document.querySelector(".maplibregl-canvas")===(window as Window & {atlasDetailCanvas?:Element|null}).atlasDetailCanvas)).toBe(true);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("revamped preset information hierarchy keeps manual edits across instant switches",async({page})=>{
  let styleRequests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    styleRequests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.waitForLoadState("networkidle");
  const before=styleRequests;
  await expect(page.locator('input[aria-label="Neighbourhood roads (Secondary) opacity"]')).toHaveValue("58");
  await page.locator('input[aria-label="Search map presets"]').fill("hiking");
  await page.getByRole("button",{name:"Apply Hiking preset"}).click();
  await expect(page.locator('input[aria-label="Walking and cycling paths opacity"]')).toHaveValue("100");
  await expect(page.locator('input[aria-label="Motorways & highways opacity"]')).toHaveValue("97");
  await page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]').fill("25");
  await page.locator('input[aria-label="Search map presets"]').fill("navigation");
  await page.getByRole("button",{name:"Apply Navigation preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]')).toHaveValue("25");
  await expect(page.locator('input[aria-label="Neighbourhood roads (Secondary) opacity"]')).toHaveValue("90");
  await page.getByRole("button",{name:"Reset to preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]')).toHaveValue("100");
  expect(styleRequests).toBe(before);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("Atlas Studio edits roads, labels and zoom rules without remounting the map",async({page})=>{
  let requests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    requests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.evaluate(()=>{(window as Window & {originalAdvancedCanvas?:Element|null}).originalAdvancedCanvas=document.querySelector(".maplibregl-canvas");});
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.waitForLoadState("networkidle");
  const count=requests;
  await expect(page.locator('section[aria-label="Advanced road styling"]')).toBeVisible();
  await page.getByRole("checkbox",{name:"Tertiary connectors (Secondary) road custom"}).check();
  await page.locator('input[aria-label="Tertiary connectors (Secondary) road color"]').fill("#8844aa");
  await page.getByRole("checkbox",{name:"Tertiary connectors (Secondary) width custom"}).check();
  await page.locator('input[aria-label="Tertiary connectors (Secondary) width"]').fill("5");
  await page.getByRole("combobox",{name:"Tertiary connectors (Secondary) dash pattern"}).selectOption("dashed");
  await page.getByRole("combobox",{name:"Tertiary connectors (Secondary) visibility"}).selectOption("hide");
  await expect(page.locator('section[aria-label="Typography studio"]')).toBeVisible();
  await page.getByRole("checkbox",{name:"Cities & major places size custom"}).check();
  await page.locator('input[aria-label="Cities & major places size"]').fill("1.5");
  await page.getByRole("checkbox",{name:"Cities & major places text custom"}).check();
  await page.locator('input[aria-label="Cities & major places text color"]').fill("#aabbcc");
  await expect(page.locator('section[aria-label="Zoom-dependent map detail"]')).toBeVisible();
  await page.locator('input[aria-label="Tertiary connectors (Secondary) min zoom"]').fill("12");
  await page.locator('section[aria-label="Zoom-dependent map detail"] details').nth(2).locator("summary").click();
  await page.locator('input[aria-label="Buildings min zoom"]').fill("14");
  await page.getByRole("button",{name:"Preview zoom 9"}).click();
  await expect.poll(async()=>Number((await page.locator(".footer-pill").textContent())?.replace(/^Z/,""))).toBeCloseTo(9,0);
  await page.getByRole("button",{name:"Preview zoom 16"}).click();
  await page.getByRole("button",{name:"Apply Paper & Ink preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) min zoom"]')).toHaveValue("12");
  await expect(page.locator('input[aria-label="Buildings min zoom"]')).toHaveValue("14");
  await expect(page.locator('input[aria-label="Cities & major places text color"]')).toHaveValue("#aabbcc");
  expect(requests).toBe(count);
  expect(await page.evaluate(()=>document.querySelector(".maplibregl-canvas")===(window as Window & {originalAdvancedCanvas?:Element|null}).originalAdvancedCanvas)).toBe(true);
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("curated road type and zoom profiles follow presets while manual edits survive",async({page})=>{
  let styleRequests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    styleRequests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.getByRole("status",{name:"Atlas preset cache status"})).toContainText("81 presets prepared in memory");
  await page.waitForLoadState("networkidle");
  const before=styleRequests;
  // The initial Minimal Light preset is deliberately quiet.
  const localWidth=page.locator('input[aria-label="Residential streets & bylanes (Secondary) width"]');
  const pathZoom=page.locator('input[aria-label="Footpaths & cycleways min zoom"]');
  await expect(localWidth).toHaveValue("1.05");
  await expect(pathZoom).toHaveValue("14");
  await page.locator('input[aria-label="Search map presets"]').fill("navigation");
  await page.getByRole("button",{name:"Apply Navigation preset"}).click();
  await expect(localWidth).toHaveValue("2");
  await expect(page.locator('input[aria-label="Road and street names size"]')).toHaveValue("1.28");
  await page.locator('input[aria-label="Tertiary connectors (Secondary) width"]').fill("5");
  await page.locator('input[aria-label="Search map presets"]').fill("hiking");
  await page.getByRole("button",{name:"Apply Hiking preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) width"]')).toHaveValue("5");
  await expect(localWidth).toHaveValue("1.05");
  await expect(page.locator('input[aria-label="Road and street names size"]')).toHaveValue("0.77");
  await page.getByRole("button",{name:"Reset advanced design to preset"}).click();
  await expect(page.locator('input[aria-label="Tertiary connectors (Secondary) width"]')).not.toHaveValue("5");
  expect(styleRequests).toBe(before);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
});

test("Primary and Secondary road controls never change each other's city street tiers",async({page})=>{
  let styleRequests=0;
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    styleRequests++;
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(fixtureStyle)});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Style studio"}).click();
  await expect(page.locator('section[aria-label="Map detail controls"]')).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  const initial=styleRequests;
  const main=page.locator('input[aria-label="Primary Roads opacity"]');
  const small=page.locator('input[aria-label="Secondary Roads opacity"]');
  const motorway=page.locator('input[aria-label="Motorways & highways opacity"]');
  const arterial=page.locator('input[aria-label="Arterial roads (Primary) opacity"]');
  const tertiary=page.locator('input[aria-label="Tertiary connectors (Secondary) opacity"]');
  const residential=page.locator('input[aria-label="Neighbourhood roads (Secondary) opacity"]');
  const paths=page.locator('input[aria-label="Walking and cycling paths opacity"]');
  const beforeSmall=[await tertiary.inputValue(),await residential.inputValue()];
  const beforePaths=await paths.inputValue();
  await main.fill("20");
  await expect(motorway).toHaveValue("20");
  await expect(arterial).toHaveValue("20");
  await expect(tertiary).toHaveValue(beforeSmall[0]);
  await expect(residential).toHaveValue(beforeSmall[1]);
  await expect(paths).toHaveValue(beforePaths);
  await small.fill("32");
  await expect(tertiary).toHaveValue("32");
  await expect(residential).toHaveValue("32");
  await expect(motorway).toHaveValue("20");
  await expect(arterial).toHaveValue("20");
  await expect(paths).toHaveValue(beforePaths);
  const primaryColor=page.getByRole("checkbox",{name:"Primary Roads group road custom"});
  const secondaryColor=page.getByRole("checkbox",{name:"Secondary Roads group road custom"});
  await primaryColor.check();
  await expect(primaryColor).toBeChecked();
  await expect(secondaryColor).not.toBeChecked();
  const primaryVisibility=page.getByRole("combobox",{name:"Primary Roads group visibility"});
  const secondaryVisibility=page.getByRole("combobox",{name:"Secondary Roads group visibility"});
  await primaryVisibility.selectOption("hide");
  await expect(secondaryVisibility).toHaveValue("inherit");
  await primaryVisibility.selectOption("inherit");
  await secondaryVisibility.selectOption("hide");
  await expect(primaryVisibility).toHaveValue("inherit");
  await expect(main).toHaveValue("20");
  await expect(small).toHaveValue("32");
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  expect(styleRequests).toBe(initial);
});
