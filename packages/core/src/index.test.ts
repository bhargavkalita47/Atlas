import {describe, expect, it} from "vitest";
import {escapeHtml,formatDistance,haversineKm,inBounds,parseCoordinatePair,pathLengthKm,safeHex,validPoint} from "./index";

describe("Atlas geographic core", () => {
  it("validates latitude and longitude", () => {
    expect(validPoint({lat:26.18,lng:91.77})).toBe(true);
    expect(validPoint({lat:100,lng:91})).toBe(false);
    expect(validPoint({lat:NaN,lng:91})).toBe(false);
  });
  it("parses explicit coordinate input", () => {
    expect(parseCoordinatePair("26.18,91.77")).toEqual({lat:26.18,lng:91.77});
    expect(parseCoordinatePair("abc,12")).toBeNull();
    expect(parseCoordinatePair("99,12")).toBeNull();
  });
  it("measures spherical distance", () => {
    expect(haversineKm({lat:0,lng:0},{lat:1,lng:0})).toBeCloseTo(111.195,1);
    expect(pathLengthKm([{lat:0,lng:0},{lat:1,lng:0},{lat:1,lng:1}])).toBeGreaterThan(220);
    expect(formatDistance(0.42)).toBe("420 m");
  });
  it("supports dateline crossing bounds", () => {
    expect(inBounds({lat:0,lng:179},{north:10,south:-10,west:170,east:-170})).toBe(true);
    expect(inBounds({lat:0,lng:-179},{north:10,south:-10,west:170,east:-170})).toBe(true);
    expect(inBounds({lat:0,lng:20},{north:10,south:-10,west:170,east:-170})).toBe(false);
  });
  it("escapes untrusted labels and only accepts hex colors", () => {
    expect(escapeHtml('<img onerror="x">')).not.toContain("<img");
    expect(safeHex("blue; background:red")).toBe("#5365da");
  });
});
