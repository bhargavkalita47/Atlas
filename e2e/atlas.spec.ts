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
  expect(startResources.some(url=>/RasterMapLoader-[^/]+\\.(js|css)/.test(url))).toBe(false);

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
