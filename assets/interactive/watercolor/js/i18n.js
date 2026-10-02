const messages = {
  zh: {
    name: "水彩模拟器", description: "自由绘画的交互水彩模拟器：连续笔迹、颜料混合、扩散与沉淀。",
    toolsPanel: "水彩工具与参数", home: "首页", color: "颜色", colorPlane: "饱和度与明度", hue: "色相", hex: "HEX 颜色",
    red: "红色分量", redValue: "红色数值", green: "绿色分量", greenValue: "绿色数值", blue: "蓝色分量", blueValue: "蓝色数值",
    brush: "笔刷", tools: "绘画工具", paint: "画笔", waterTool: "清水", size: "笔刷大小", pigment: "颜料浓度", water: "笔含水量",
    paper: "纸面", diffusion: "扩散强度", sediment: "沉淀速度", more: "更多", edges: "边缘积色", drying: "干燥速度", humidity: "环境湿度",
    reset: "重置", actions: "作品操作", pause: "暂停", resume: "继续", dry: "晾干", discard: "丢弃", save: "导出 PNG", download: "下载 PNG",
    canvas: "水彩画纸", exportError: "导出失败", initError: "画纸初始化失败",
    palette: "试色与预设", swatch: "试色", swatchCanvas: "试色画板", myPresets: "我的预设", clearSwatch: "清空",
    emptyPresets: "暂无预设", collapse: "收起", expand: "展开", closePresetDetails: "关闭参数详情", deletePreset: "删除",
    waterShort: "水", pigmentShort: "浓度",
    paperSize: "纸张尺寸", paperSizeLocked: "纸张有笔迹", paperWidth: "宽度", paperHeight: "高度", close: "关闭", cancel: "取消", apply: "应用",
  },
  en: {
    name: "Watercolor Simulation", description: "A watercolor simulator with continuous brush strokes, pigment mixing, diffusion and settling.",
    toolsPanel: "Watercolor tools and settings", home: "Home", color: "Color", colorPlane: "Saturation and brightness", hue: "Hue", hex: "HEX color",
    red: "Red channel", redValue: "Red value", green: "Green channel", greenValue: "Green value", blue: "Blue channel", blueValue: "Blue value",
    brush: "Brush", tools: "Painting tools", paint: "Paint", waterTool: "Water", size: "Brush size", pigment: "Pigment load", water: "Water load",
    paper: "Paper", diffusion: "Diffusion", sediment: "Settling", more: "More", edges: "Edge pooling", drying: "Drying rate", humidity: "Humidity",
    reset: "Reset", actions: "Painting actions", pause: "Pause", resume: "Resume", dry: "Dry", discard: "Discard", save: "Export PNG", download: "Download PNG",
    canvas: "Watercolor paper", exportError: "Export failed", initError: "Unable to initialize the paper",
    palette: "Swatches and presets", swatch: "Swatch", swatchCanvas: "Swatch board", myPresets: "My presets", clearSwatch: "Clear",
    emptyPresets: "No presets yet", collapse: "Collapse", expand: "Expand", closePresetDetails: "Close preset details", deletePreset: "Delete",
    waterShort: "Water", pigmentShort: "Pigment",
    paperSize: "Paper size", paperSizeLocked: "Paper has brush strokes", paperWidth: "Width", paperHeight: "Height", close: "Close", cancel: "Cancel", apply: "Apply",
  },
};

let language = document.documentElement.lang.startsWith("en") ? "en" : "zh";
export const t = (key) => messages[language][key];

export function setLanguage(value) {
  language = value === "en" ? "en" : "zh";
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  document.title = t("name");
  document.querySelector('meta[name="description"]').content = t("description");
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const [attribute, key] of [["aria-label", "i18nAria"], ["title", "i18nTitle"]]) {
    for (const node of document.querySelectorAll(`[data-${key.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase())}]`)) {
      node.setAttribute(attribute, t(node.dataset[key]));
    }
  }
  const link = document.getElementById("language");
  const english = language === "en";
  link.textContent = english ? "中文" : "EN";
  link.lang = english ? "zh-CN" : "en";
  link.href = english ? link.dataset.zhUrl : link.dataset.enUrl;
  link.setAttribute("aria-label", english ? "中文" : "English");
  document.dispatchEvent(new Event("watercolor-languagechange"));
}

setLanguage(language);

document.getElementById("language").addEventListener("click", (event) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  // Switching the interface preserves the paper, wet pigment and elapsed time.
  window.history.replaceState(null, "", event.currentTarget.href);
  setLanguage(language === "en" ? "zh" : "en");
});
