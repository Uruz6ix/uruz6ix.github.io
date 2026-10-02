import { DEFAULTS } from "./config.js";
import { t } from "./i18n.js";
import { PresetStore, normalizeSettings, sameSettings } from "./presets.js";
import { SwatchSurface } from "./swatch.js";

export function initPalette({ getSettings, applySettings, isDrawing }) {
  const $ = (id) => document.getElementById(id);
  const store = new PresetStore();
  let activeId = null;
  let detailsId = null;
  let collapsed = false;
  const surface = new SwatchSurface($("trial-canvas"), $("trial-cursor"), getSettings, refreshAvailability, recordSample);
  const presets = () => store.presets;
  const drawing = () => isDrawing() || surface.pointerId !== null;
  const toolName = (settings) => t(settings.tool === "water" ? "waterTool" : "paint");

  function recordSample(sample) {
    activeId = store.record(sample).id;
    renderCards(true);
    refreshInspector();
  }

  function fillSettings(element, settings) {
    element.replaceChildren(...["tool", ...Object.keys(DEFAULTS).filter((key) => key !== "color")].map((key) => {
      const group = document.createElement("div");
      const label = document.createElement("dt");
      const value = document.createElement("dd");
      label.textContent = t(key === "tool" ? "tools" : key);
      value.textContent = key === "tool" ? toolName(settings) : `${settings[key]}${key === "size" ? " px" : "%"}`;
      group.append(label, value);
      return group;
    }));
  }

  function refreshInspector() {
    const preset = presets().find((item) => item.id === detailsId);
    $("preset-inspector").hidden = collapsed || !preset;
    if (!preset) return;
    $("inspector-hex").textContent = preset.settings.color.toUpperCase();
    $("preset-inspector").style.setProperty("--swatch-color", preset.settings.color);
    fillSettings($("inspector-settings"), preset.settings);
  }

  function refreshActive() {
    for (const card of $("preset-cards").querySelectorAll(".preset-card")) card.setAttribute("aria-pressed", String(card.dataset.presetId === activeId));
  }

  function refreshSettings() {
    const settings = normalizeSettings(getSettings());
    surface.updateSettings();
    $("trial-hex").textContent = settings.color.toUpperCase();
    $("trial-color-dot").style.background = settings.color;
    $("trial-tool").textContent = toolName(settings);
    for (const key of ["size", "water", "pigment", "diffusion", "sediment"]) {
      $("trial-" + key).textContent = key === "size" ? `${settings.size} px` : `${t(key === "water" ? "waterShort" : key === "pigment" ? "pigmentShort" : key)} ${settings[key]}%`;
    }
    const active = presets().find((item) => item.id === activeId);
    if (!active || !sameSettings(settings, active.settings)) activeId = null;
    refreshActive();
  }

  function choosePreset(preset) {
    if (drawing() || !applySettings(preset.settings)) return;
    activeId = preset.id;
    detailsId = preset.id;
    refreshSettings();
    refreshInspector();
  }

  function renderCards(resetScroll = false) {
    const list = $("preset-cards");
    const scroll = list.scrollLeft;
    list.replaceChildren();
    list.classList.toggle("is-empty", presets().length === 0);
    $("preset-count").textContent = presets().length;
    if (!presets().length) {
      const empty = document.createElement("div");
      empty.className = "preset-empty";
      empty.textContent = t("emptyPresets");
      list.append(empty);
    }
    for (const preset of presets()) {
      const { settings, thumbnail } = preset;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "preset-card";
      card.dataset.presetId = preset.id;
      card.setAttribute("aria-label", `${settings.color.toUpperCase()} · ${toolName(settings)} · ${settings.size} px`);
      const sample = document.createElement(thumbnail ? "img" : "span");
      sample.className = "preset-specimen";
      if (thumbnail) { sample.src = thumbnail; sample.alt = ""; }
      else { sample.style.background = settings.color; sample.setAttribute("aria-hidden", "true"); }
      const content = document.createElement("span");
      content.className = "preset-card-copy";
      const colorLine = document.createElement("span");
      colorLine.className = "preset-color-line";
      const dot = document.createElement("span");
      dot.className = "preset-color";
      dot.style.background = settings.color;
      const title = document.createElement("strong");
      title.className = "preset-hex";
      title.textContent = settings.color.toUpperCase();
      const more = document.createElement("span");
      more.className = "preset-info-icon";
      more.setAttribute("aria-hidden", "true");
      more.textContent = "⋯";
      colorLine.append(dot, title, more);
      const parameters = document.createElement("span");
      parameters.className = "preset-parameters";
      for (const text of [`${settings.size} px`, `${t("waterShort")} ${settings.water}%`, `${t("pigmentShort")} ${settings.pigment}%`, `${t("diffusion")} ${settings.diffusion}%`, `${t("sediment")} ${settings.sediment}%`]) {
        const value = document.createElement("span");
        value.textContent = text;
        parameters.append(value);
      }
      content.append(colorLine, parameters);
      card.append(sample, content);
      card.addEventListener("click", () => choosePreset(preset));
      list.append(card);
    }
    list.scrollLeft = resetScroll ? 0 : scroll;
    refreshActive();
    refreshAvailability();
  }

  function refreshAvailability() {
    const disabled = drawing();
    for (const id of ["trial-clear", "palette-collapse", "preset-delete"]) $(id).disabled = disabled;
    for (const card of $("preset-cards").querySelectorAll(".preset-card")) card.disabled = disabled;
  }

  $("trial-clear").addEventListener("click", () => surface.clear());
  $("inspector-close").addEventListener("click", () => { detailsId = null; refreshInspector(); });
  $("preset-delete").addEventListener("click", () => {
    if (!detailsId || drawing()) return;
    store.remove(detailsId);
    if (activeId === detailsId) activeId = null;
    detailsId = null;
    renderCards();
    refreshInspector();
  });
  $("palette-collapse").addEventListener("click", () => {
    collapsed = !collapsed;
    document.querySelector(".palette-deck").classList.toggle("is-collapsed", collapsed);
    $("trial-board").hidden = collapsed;
    $("trial-clear").hidden = collapsed;
    $("preset-cards").hidden = collapsed;
    $("palette-collapse").setAttribute("aria-expanded", String(!collapsed));
    $("palette-collapse").firstElementChild.textContent = t(collapsed ? "expand" : "collapse");
    refreshInspector();
  });
  document.addEventListener("watercolor-languagechange", () => {
    renderCards();
    refreshSettings();
    refreshInspector();
    $("palette-collapse").firstElementChild.textContent = t(collapsed ? "expand" : "collapse");
  });
  renderCards();
  refreshSettings();
  return { refreshSettings, refreshAvailability, clearSwatch: () => surface.clear(), tick: (elapsed, paused) => surface.tick(elapsed, paused) };
}
