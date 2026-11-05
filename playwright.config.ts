import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  timeout:40_000,
  expect:{timeout:20_000},
  retries:process.env.CI?1:0,
  reporter:process.env.CI?"github":"list",
  use:{
    baseURL:"http://127.0.0.1:4173",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    launchOptions:{
      args:[
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader"
      ]
    }
  },
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
  webServer:{
    command:"npm run preview --workspace=atlas-playground -- --host 127.0.0.1 --port 4173",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:!process.env.CI,
    timeout:45_000
  }
});
