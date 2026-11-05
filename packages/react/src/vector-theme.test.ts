import { describe,it,expect } from "vitest";
import { DEFAULT_VECTOR_THEME, KEYLESS_VECTOR_STYLES } from "./VectorMap";
describe("keyless vector map configuration",()=>{
  it("does not require any paid map API key",()=>{
    expect(Object.values(KEYLESS_VECTOR_STYLES).every(s=>s.startsWith("https://tiles.openfreemap.org/"))).toBe(true);
  });
  it("provides safe default theme colors",()=>{
    expect(Object.values(DEFAULT_VECTOR_THEME).every(s=>/^#[0-9a-f]{6}$/i.test(s))).toBe(true);
  });
});
