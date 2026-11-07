import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const style={
  version:8,
  name:"Atlas export fixture",
  sources:{places:{type:"geojson",data:{type:"FeatureCollection",
    features:[{type:"Feature",geometry:{type:"Point",coordinates:[91.7606,26.1716]},
      properties:{name:"Atlas fixture"}}]}}},
  layers:[
    {id:"background",type:"background",paint:{"background-color":"#f6f7f9"}},
    {id:"places-dot",type:"circle",source:"places",paint:{"circle-color":"#4477cc","circle-radius":5}}
  ]
};

test.beforeEach(async({page})=>{
  await page.route("https://tiles.openfreemap.org/styles/**",async route=>{
    await route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},body:JSON.stringify(style)});
  });
});

test("exports a versioned portable JSON bundle and imports it without losing map pins",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("tab",{name:"Export",exact:true}).click();
  const [download]=await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button",{name:/Export Atlas theme JSON/}).click()
  ]);
  expect(download.suggestedFilename()).toBe("atlas-theme-v1.json");
  const filename=await download.path();
  expect(filename).toBeTruthy();
  const data=JSON.parse(readFileSync(filename!,"utf8"));
  expect(data.format).toBe("atlas-theme");
  expect(data.schemaVersion).toBe(1);
  expect(data.styleDocumentVersion).toBe(2);
  expect(data).toHaveProperty("advancedOverrides.labels");
  expect(data).toHaveProperty("semanticOverrides");
  expect(data).toHaveProperty("detailOverrides.roads");
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
    name:"atlas-theme-v1.json",
    mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(data))
  });
  await expect(page.getByText(/Atlas theme imported/)).toBeVisible();
  await expect(page.locator(".atlas-vector-pin")).toHaveCount(3);
});

test("captures map viewport PNG as a real image download",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button",{name:"Style studio"}).click();
  await page.getByRole("tab",{name:"Export",exact:true}).click();
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:20000}),
    page.getByRole("button",{name:/Export PNG/}).click()
  ]);
  expect(download.suggestedFilename()).toBe("atlas-map.png");
  const raw=readFileSync((await download.path())!);
  expect(raw.length).toBeGreaterThan(1000);
  expect(raw.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
});
