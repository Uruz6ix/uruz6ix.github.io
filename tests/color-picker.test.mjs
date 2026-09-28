import test from "node:test";
import assert from "node:assert/strict";
import { hsvToRgb, rgbToHsv, rgbToHex, hexToChannels } from "../assets/interactive/watercolor/js/color-picker.js";

test("Photoshop-style plane has white and pure hue at the top, black at the bottom", () => {
  for (const [hue, hex] of [[0, "#ff0000"], [60, "#ffff00"], [120, "#00ff00"], [180, "#00ffff"], [240, "#0000ff"], [300, "#ff00ff"]]) {
    assert.equal(rgbToHex(hsvToRgb(hue, 0, 1)), "#ffffff");
    assert.equal(rgbToHex(hsvToRgb(hue, 1, 1)), hex);
    assert.equal(rgbToHex(hsvToRgb(hue, 1, 0)), "#000000");
  }
});

test("HSV, HEX and RGB agree for saturated and interior colors", () => {
  for (const color of ["#3577aa", "#808080", "#fff000", "#123456", "#d3d7de", "#ff0000", "#000000", "#ffffff"]) {
    const rgb = hexToChannels(color);
    const hsv = rgbToHsv(rgb);
    assert.equal(rgbToHex(hsvToRgb(hsv.hue, hsv.saturation, hsv.value)), color);
  }
  assert.equal(rgbToHex(hsvToRgb(360, 1, 1)), "#ff0000");
  assert.equal(rgbToHex(hsvToRgb(-60, 1, 1)), "#ff00ff");
});

test("gray and black preserve the chosen hue for subsequent saturation changes", () => {
  assert.equal(rgbToHsv([0.5, 0.5, 0.5], 210).hue, 210);
  assert.equal(rgbToHsv([0, 0, 0], 300).hue, 300);
  assert.equal(rgbToHex(hsvToRgb(300, 1, 1)), "#ff00ff");
});
