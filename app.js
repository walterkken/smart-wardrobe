const STORAGE_KEY = "smart-wardrobe-v1";

const COLORS = {
  black: { label: "黑色", hex: "#111111", neutral: true, hue: 0 },
  white: { label: "白色", hex: "#f7f5ef", neutral: true, hue: 0 },
  gray: { label: "灰色", hex: "#8a8f91", neutral: true, hue: 0 },
  navy: { label: "藏蓝", hex: "#1d3557", neutral: true, hue: 220 },
  denim: { label: "牛仔蓝", hex: "#3d6f9f", neutral: true, hue: 210 },
  beige: { label: "米色", hex: "#c8b99b", neutral: true, hue: 45 },
  brown: { label: "棕色", hex: "#7c4f33", neutral: true, hue: 30 },
  red: { label: "红色", hex: "#c94e3f", neutral: false, hue: 8 },
  pink: { label: "粉色", hex: "#d88aa4", neutral: false, hue: 338 },
  orange: { label: "橙色", hex: "#d77a2f", neutral: false, hue: 25 },
  yellow: { label: "黄色", hex: "#d9b23f", neutral: false, hue: 48 },
  green: { label: "绿色", hex: "#4f8d64", neutral: false, hue: 134 },
  teal: { label: "青绿色", hex: "#0c7c74", neutral: false, hue: 176 },
  blue: { label: "蓝色", hex: "#3867b7", neutral: false, hue: 220 },
  purple: { label: "紫色", hex: "#7467a8", neutral: false, hue: 250 },
};

const CATEGORY_LABELS = {
  top: "上装",
  bottom: "下装",
  dress: "连体/裙装",
  outer: "外套",
  shoes: "鞋子",
  accessory: "配饰",
};

const STYLE_LABELS = {
  casual: "休闲",
  commute: "通勤",
  formal: "正式",
  sport: "运动",
  date: "约会",
  outdoor: "户外",
};

const WARMTH_LABELS = {
  light: "轻薄",
  medium: "常规",
  warm: "保暖",
};

const CONDITION_LABELS = {
  clear: "晴",
  cloudy: "多云",
  rain: "雨",
  snow: "雪",
  wind: "大风",
  hot: "炎热",
};

const state = loadState();
let pendingImages = [];
let lastGeneratedOutfits = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const refs = {
  itemForm: $("#itemForm"),
  editId: $("#editId"),
  itemPhotos: $("#itemPhotos"),
  photoPreview: $("#photoPreview"),
  uploadEmpty: $("#uploadEmpty"),
  uploadCount: $("#uploadCount"),
  clearPhotoBtn: $("#clearPhotoBtn"),
  itemName: $("#itemName"),
  itemCategory: $("#itemCategory"),
  itemColor: $("#itemColor"),
  itemWarmth: $("#itemWarmth"),
  itemStyle: $("#itemStyle"),
  itemSeason: $("#itemSeason"),
  itemTags: $("#itemTags"),
  rainReady: $("#rainReady"),
  favoriteItem: $("#favoriteItem"),
  resetFormBtn: $("#resetFormBtn"),
  closetGrid: $("#closetGrid"),
  searchInput: $("#searchInput"),
  filterCategory: $("#filterCategory"),
  filterStyle: $("#filterStyle"),
  statItems: $("#statItems"),
  statOutfits: $("#statOutfits"),
  statWeather: $("#statWeather"),
  statCoverage: $("#statCoverage"),
  recommendStyle: $("#recommendStyle"),
  colorStrategy: $("#colorStrategy"),
  recommendTemp: $("#recommendTemp"),
  recommendCondition: $("#recommendCondition"),
  generateBtn: $("#generateBtn"),
  useWeatherBtn: $("#useWeatherBtn"),
  recommendSummary: $("#recommendSummary"),
  outfitResults: $("#outfitResults"),
  cityInput: $("#cityInput"),
  fetchWeatherBtn: $("#fetchWeatherBtn"),
  geoWeatherBtn: $("#geoWeatherBtn"),
  weatherTemp: $("#weatherTemp"),
  weatherCondition: $("#weatherCondition"),
  weatherMeta: $("#weatherMeta"),
  manualTemp: $("#manualTemp"),
  manualCondition: $("#manualCondition"),
  saveManualWeatherBtn: $("#saveManualWeatherBtn"),
  savedOutfits: $("#savedOutfits"),
  clearSavedBtn: $("#clearSavedBtn"),
  seedBtn: $("#seedBtn"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput"),
  toast: $("#toast"),
};

init();

function init() {
  populateColorSelect();
  bindEvents();
  syncWeatherControls();
  renderAll();
}

function populateColorSelect() {
  const options = Object.entries(COLORS)
    .map(([value, color]) => `<option value="${value}">${color.label}</option>`)
    .join("");
  refs.itemColor.innerHTML = options;
}

function bindEvents() {
  $$(".tab-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  refs.itemPhotos.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    pendingImages = await Promise.all(files.map(readAndResizeImage));
    updatePhotoPreview();
  });

  refs.clearPhotoBtn.addEventListener("click", () => {
    pendingImages = [];
    refs.itemPhotos.value = "";
    updatePhotoPreview();
  });

  refs.itemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveItemFromForm();
  });

  refs.resetFormBtn.addEventListener("click", resetForm);

  [refs.searchInput, refs.filterCategory, refs.filterStyle].forEach((input) => {
    input.addEventListener("input", renderCloset);
    input.addEventListener("change", renderCloset);
  });

  refs.generateBtn.addEventListener("click", () => {
    generateAndRenderOutfits();
    activateTab("recommend");
  });

  refs.useWeatherBtn.addEventListener("click", () => {
    syncWeatherControls();
    toast("已把当前天气带入推荐条件");
  });

  refs.fetchWeatherBtn.addEventListener("click", fetchCityWeather);
  refs.geoWeatherBtn.addEventListener("click", fetchGeoWeather);
  refs.saveManualWeatherBtn.addEventListener("click", saveManualWeather);
  refs.clearSavedBtn.addEventListener("click", clearSavedOutfits);
  refs.seedBtn.addEventListener("click", seedWardrobe);
  refs.exportBtn.addEventListener("click", exportData);
  refs.importInput.addEventListener("change", importData);
}

function activateTab(tabName) {
  $$(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  $$(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        items: [],
        savedOutfits: [],
        weather: { temp: 22, condition: "clear", city: "手动天气", updatedAt: null },
      };
    }
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      savedOutfits: Array.isArray(parsed.savedOutfits) ? parsed.savedOutfits : [],
      weather: parsed.weather || { temp: 22, condition: "clear", city: "手动天气", updatedAt: null },
    };
  } catch {
    return {
      items: [],
      savedOutfits: [],
      weather: { temp: 22, condition: "clear", city: "手动天气", updatedAt: null },
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderStats();
  renderCloset();
  renderWeather();
  renderSavedOutfits();
}

function renderStats() {
  refs.statItems.textContent = state.items.length;
  refs.statOutfits.textContent = state.savedOutfits.length;
  refs.statWeather.textContent = `${state.weather.temp}°C ${CONDITION_LABELS[state.weather.condition] || "天气"}`;

  const categories = new Set(state.items.map((item) => item.category));
  const required = ["top", "bottom", "shoes"];
  const hasDressPath = categories.has("dress") && categories.has("shoes");
  const complete = required.every((category) => categories.has(category)) || hasDressPath;
  refs.statCoverage.textContent = complete ? "可搭配" : `${categories.size}/6`;
}

function filteredItems() {
  const query = refs.searchInput.value.trim().toLowerCase();
  const category = refs.filterCategory.value;
  const style = refs.filterStyle.value;

  return state.items.filter((item) => {
    const queryText = [item.name, item.tags.join(" "), CATEGORY_LABELS[item.category], STYLE_LABELS[item.style]]
      .join(" ")
      .toLowerCase();
    return (
      (!query || queryText.includes(query)) &&
      (category === "all" || item.category === category) &&
      (style === "all" || item.style === style)
    );
  });
}

function renderCloset() {
  const items = filteredItems();
  if (!items.length) {
    refs.closetGrid.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>衣橱还是空的</strong><br />
          上传衣物照片并补充标签后，这里会显示你的单品。
        </div>
      </div>
    `;
    return;
  }

  refs.closetGrid.innerHTML = items
    .map(
      (item) => `
        <article class="closet-card" data-id="${item.id}">
          <div class="closet-image">${renderItemImage(item)}</div>
          <div class="closet-body">
            <div class="closet-title-row">
              <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
              <span class="color-pill" style="--swatch:${COLORS[item.color]?.hex || "#ddd"}">${colorLabel(item.color)}</span>
            </div>
            <div class="pill-row">
              <span class="pill">${CATEGORY_LABELS[item.category]}</span>
              <span class="pill">${STYLE_LABELS[item.style]}</span>
              <span class="pill">${WARMTH_LABELS[item.warmth]}</span>
            </div>
            <div class="pill-row">
              ${item.tags.slice(0, 4).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
            </div>
            <div class="card-actions">
              <button class="icon-button" type="button" title="编辑" aria-label="编辑 ${escapeHtml(item.name)}" data-action="edit" data-id="${item.id}">✎</button>
              <button class="icon-button danger" type="button" title="删除" aria-label="删除 ${escapeHtml(item.name)}" data-action="delete" data-id="${item.id}">×</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  refs.closetGrid.querySelectorAll("[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => editItem(button.dataset.id));
  });
  refs.closetGrid.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteItem(button.dataset.id));
  });
}

function renderItemImage(item) {
  if (item.image) {
    return `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
  }
  return `<div class="placeholder-garment" style="background:${placeholderBackground(item.color)}">${CATEGORY_LABELS[item.category]}</div>`;
}

function saveItemFromForm() {
  const editId = refs.editId.value;
  const editing = state.items.find((item) => item.id === editId);
  const images = pendingImages.length ? pendingImages : editing?.image ? [{ dataUrl: editing.image, name: editing.name }] : [];

  if (!images.length && !refs.itemName.value.trim()) {
    toast("请至少填写名称或上传图片");
    return;
  }

  if (editId && editing) {
    Object.assign(editing, itemPayload(images[0]));
    saveState();
    resetForm();
    renderAll();
    toast("已更新衣物");
    return;
  }

  const payloads = images.length ? images : [{ dataUrl: "", name: "" }];
  const newItems = payloads.map((image, index) => ({
    id: uid(),
    createdAt: new Date().toISOString(),
    ...itemPayload(image, index, payloads.length),
  }));

  state.items.unshift(...newItems);
  saveState();
  resetForm();
  renderAll();
  toast(`已入柜 ${newItems.length} 件衣物`);
}

function itemPayload(image, index = 0, total = 1) {
  const baseName = refs.itemName.value.trim() || image?.name || `新衣物 ${state.items.length + index + 1}`;
  const name = total > 1 && refs.itemName.value.trim() ? `${baseName} ${index + 1}` : baseName;
  const tags = refs.itemTags.value
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (refs.rainReady.checked && !tags.includes("防水")) tags.push("防水");
  if (refs.favoriteItem.checked && !tags.includes("常穿")) tags.push("常穿");

  return {
    name,
    category: refs.itemCategory.value,
    color: refs.itemColor.value,
    warmth: refs.itemWarmth.value,
    style: refs.itemStyle.value,
    season: refs.itemSeason.value,
    tags,
    rainReady: refs.rainReady.checked,
    favorite: refs.favoriteItem.checked,
    image: image?.dataUrl || "",
    updatedAt: new Date().toISOString(),
  };
}

function editItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  refs.editId.value = item.id;
  refs.itemName.value = item.name;
  refs.itemCategory.value = item.category;
  refs.itemColor.value = item.color;
  refs.itemWarmth.value = item.warmth;
  refs.itemStyle.value = item.style;
  refs.itemSeason.value = item.season;
  refs.itemTags.value = item.tags.join(", ");
  refs.rainReady.checked = item.rainReady;
  refs.favoriteItem.checked = item.favorite;
  pendingImages = item.image ? [{ dataUrl: item.image, name: item.name }] : [];
  updatePhotoPreview();
  activateTab("wardrobe");
  toast("正在编辑衣物");
}

function deleteItem(id) {
  const index = state.items.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  state.items.splice(index, 1);
  state.savedOutfits = state.savedOutfits.filter((outfit) => !outfit.itemIds.includes(id));
  saveState();
  renderAll();
  toast("已删除衣物");
}

function resetForm() {
  refs.itemForm.reset();
  refs.editId.value = "";
  refs.itemWarmth.value = "medium";
  refs.itemSeason.value = "all";
  pendingImages = [];
  refs.itemPhotos.value = "";
  updatePhotoPreview();
}

function updatePhotoPreview() {
  if (pendingImages.length) {
    refs.photoPreview.src = pendingImages[0].dataUrl;
    refs.photoPreview.hidden = false;
    refs.uploadEmpty.hidden = true;
    refs.uploadCount.textContent =
      pendingImages.length === 1 ? pendingImages[0].name || "已选择 1 张图片" : `已选择 ${pendingImages.length} 张图片`;
    return;
  }
  refs.photoPreview.removeAttribute("src");
  refs.photoPreview.hidden = true;
  refs.uploadEmpty.hidden = false;
  refs.uploadCount.textContent = "未选择图片";
}

function readAndResizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 900;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          name: file.name.replace(/\.[^.]+$/, ""),
          dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function generateAndRenderOutfits() {
  const weather = {
    temp: Number(refs.recommendTemp.value || state.weather.temp || 22),
    condition: refs.recommendCondition.value || state.weather.condition || "clear",
  };
  const style = refs.recommendStyle.value;
  const strategy = refs.colorStrategy.value;
  const outfits = generateOutfits({ weather, style, strategy });
  lastGeneratedOutfits = outfits;
  renderOutfitResults(outfits, weather);
}

function generateOutfits({ weather, style, strategy }) {
  const tops = rankCandidates("top", weather, style).slice(0, 10);
  const bottoms = rankCandidates("bottom", weather, style).slice(0, 10);
  const dresses = rankCandidates("dress", weather, style).slice(0, 10);
  const shoes = rankCandidates("shoes", weather, style).slice(0, 10);
  const outerCandidates = rankCandidates("outer", weather, style).slice(0, 8);
  const accessories = rankCandidates("accessory", weather, style).slice(0, 6);
  const needsOuter = weather.temp < 18 || ["rain", "snow", "wind"].includes(weather.condition);
  const outerOptions = needsOuter ? (outerCandidates.length ? outerCandidates : [null]) : [null, ...outerCandidates.slice(0, 3)];
  const accessoryOptions = [null, ...accessories.slice(0, 3)];
  const combinations = [];

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        for (const outer of outerOptions) {
          for (const accessory of accessoryOptions) {
            combinations.push(scoreOutfit([top, bottom, shoe, outer, accessory].filter(Boolean), weather, style, strategy));
          }
        }
      }
    }
  }

  for (const dress of dresses) {
    for (const shoe of shoes) {
      for (const outer of outerOptions) {
        for (const accessory of accessoryOptions) {
          combinations.push(scoreOutfit([dress, shoe, outer, accessory].filter(Boolean), weather, style, strategy));
        }
      }
    }
  }

  return combinations
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .filter(uniqueOutfit())
    .slice(0, 6);
}

function rankCandidates(category, weather, style) {
  return state.items
    .filter((item) => item.category === category)
    .map((item) => ({ item, score: itemBaseScore(item, weather, style) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

function itemBaseScore(item, weather, style) {
  let score = 20;
  if (item.style === style) score += 18;
  if (item.favorite) score += 8;
  if (item.tags.includes("常穿")) score += 5;
  score += warmthScore(item, weather);
  score += conditionScore(item, weather);
  score += seasonScore(item, weather);
  return score;
}

function warmthScore(item, weather) {
  const temp = weather.temp;
  if (temp <= 6) return item.warmth === "warm" ? 16 : item.warmth === "medium" ? 7 : -12;
  if (temp <= 15) return item.warmth === "warm" ? 10 : item.warmth === "medium" ? 12 : -3;
  if (temp <= 25) return item.warmth === "medium" ? 10 : item.warmth === "light" ? 8 : -4;
  return item.warmth === "light" ? 16 : item.warmth === "medium" ? 4 : -14;
}

function conditionScore(item, weather) {
  if (weather.condition === "rain") {
    if (item.rainReady || item.tags.includes("防水")) return 15;
    if (item.category === "shoes" || item.category === "outer") return -8;
  }
  if (weather.condition === "snow") {
    if (item.warmth === "warm") return 12;
    if (item.warmth === "light") return -10;
  }
  if (weather.condition === "wind" && item.category === "outer") return item.warmth !== "light" ? 10 : 2;
  if (weather.condition === "hot") return item.warmth === "light" ? 12 : -8;
  return 0;
}

function seasonScore(item, weather) {
  if (item.season === "all") return 4;
  if (weather.temp >= 26 && item.season === "summer") return 8;
  if (weather.temp <= 10 && item.season === "winter") return 8;
  if (weather.temp > 10 && weather.temp < 24 && item.season === "spring") return 8;
  return -3;
}

function scoreOutfit(items, weather, style, strategy) {
  const categories = new Set(items.map((item) => item.category));
  const hasCore = (categories.has("top") && categories.has("bottom") && categories.has("shoes")) || (categories.has("dress") && categories.has("shoes"));
  if (!hasCore) return null;

  let score = 50;
  let reasons = [];

  const styleMatches = items.filter((item) => item.style === style).length;
  score += styleMatches * 9;
  if (styleMatches >= Math.min(3, items.length)) {
    reasons.push(`风格以${STYLE_LABELS[style]}为主，正式度一致`);
  } else {
    reasons.push(`保留${STYLE_LABELS[style]}核心单品，混搭程度适中`);
  }

  const color = colorScore(items, strategy);
  score += color.score;
  reasons.push(color.reason);

  const comfort = comfortReason(items, weather);
  score += comfort.score;
  reasons.push(comfort.reason);

  if (items.some((item) => item.favorite)) {
    score += 6;
    reasons.push("包含常穿单品，复穿成功率更高");
  }

  if (weather.condition === "rain" && items.some((item) => item.rainReady || item.tags.includes("防水"))) {
    score += 10;
    reasons.push("雨天优先加入防水标签单品");
  }

  return {
    id: uid(),
    score: Math.max(0, Math.round(score)),
    items,
    reasons: reasons.slice(0, 4),
    weather,
    style,
    createdAt: new Date().toISOString(),
  };
}

function colorScore(items, strategy) {
  const colors = items.map((item) => COLORS[item.color]).filter(Boolean);
  const chromatic = colors.filter((color) => !color.neutral);
  const neutral = colors.length - chromatic.length;
  const hues = chromatic.map((color) => color.hue);

  if (!chromatic.length) {
    return { score: strategy === "accent" ? 12 : 24, reason: "全身中性色，干净耐看" };
  }

  if (chromatic.length === 1 && neutral >= 1) {
    return { score: strategy === "minimal" ? 20 : 28, reason: "中性色打底，只保留一个重点色" };
  }

  const maxDiff = hueSpread(hues);
  const hasComplement = huePairs(hues).some((diff) => diff >= 150 && diff <= 210);
  const hasAnalog = maxDiff <= 45;

  if (hasAnalog) {
    return { score: 24, reason: "主色接近同色系，整体感强" };
  }
  if (hasComplement) {
    return { score: strategy === "accent" ? 26 : 18, reason: "使用互补色制造亮点，适合想更醒目的穿法" };
  }
  if (chromatic.length > 2) {
    return { score: 6, reason: "颜色较丰富，建议减少一个亮色会更稳" };
  }
  return { score: 15, reason: "颜色对比适中，靠中性色压住整体" };
}

function comfortReason(items, weather) {
  const hasOuter = items.some((item) => item.category === "outer");
  const warmCount = items.filter((item) => item.warmth === "warm").length;
  const lightCount = items.filter((item) => item.warmth === "light").length;

  if (weather.temp <= 8) {
    return {
      score: hasOuter && warmCount ? 24 : -10,
      reason: hasOuter && warmCount ? "低温加入保暖层，适合冷天" : "低温天气建议补一件保暖外套",
    };
  }
  if (weather.temp >= 28) {
    return {
      score: lightCount >= 2 ? 24 : -8,
      reason: lightCount >= 2 ? "高温优先轻薄单品，透气度更好" : "高温天气建议换成更轻薄的单品",
    };
  }
  if (["rain", "wind"].includes(weather.condition)) {
    return {
      score: hasOuter ? 18 : -5,
      reason: hasOuter ? "雨风天气保留外套层，更实用" : "雨风天气建议增加外套层",
    };
  }
  return { score: 14, reason: "温度适中，不需要过度叠穿" };
}

function renderOutfitResults(outfits, weather) {
  if (!state.items.length) {
    refs.recommendSummary.textContent = "衣橱为空，先上传几件衣物。";
    refs.outfitResults.innerHTML = `<div class="empty-state">先在衣橱里加入上装、下装和鞋子，或加入连体/裙装和鞋子。</div>`;
    return;
  }

  if (!outfits.length) {
    refs.recommendSummary.textContent = "当前衣物不足以组成完整搭配。";
    refs.outfitResults.innerHTML = `<div class="empty-state">至少需要：上装 + 下装 + 鞋子，或连体/裙装 + 鞋子。</div>`;
    return;
  }

  refs.recommendSummary.textContent = `${weather.temp}°C ${CONDITION_LABELS[weather.condition]}，找到 ${outfits.length} 套可穿方案。`;
  refs.outfitResults.innerHTML = outfits.map(renderOutfitCard).join("");
  refs.outfitResults.querySelectorAll("[data-save-outfit]").forEach((button) => {
    button.addEventListener("click", () => saveOutfit(button.dataset.saveOutfit));
  });
}

function renderOutfitCard(outfit) {
  return `
    <article class="outfit-card">
      <div class="outfit-gallery">
        ${outfit.items
          .map(
            (item) => `
              <div class="outfit-thumb" title="${escapeHtml(item.name)}">
                ${renderItemImage(item)}
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="outfit-body">
        <div class="score-row">
          <strong>${STYLE_LABELS[outfit.style]}搭配</strong>
          <span class="score">${outfit.score} 分</span>
        </div>
        <div class="outfit-items">
          ${outfit.items.map((item) => `<span class="pill">${escapeHtml(item.name)}</span>`).join("")}
        </div>
        <ul class="reason-list">
          ${outfit.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
        </ul>
        <button class="ghost-button" type="button" data-save-outfit="${outfit.id}">收藏这套</button>
      </div>
    </article>
  `;
}

function saveOutfit(outfitId) {
  const outfit = lastGeneratedOutfits.find((entry) => entry.id === outfitId);
  if (!outfit) return;

  state.savedOutfits.unshift({
    id: uid(),
    itemIds: outfit.items.map((item) => item.id),
    score: outfit.score,
    reasons: outfit.reasons,
    weather: outfit.weather,
    style: outfit.style,
    createdAt: new Date().toISOString(),
  });
  saveState();
  renderAll();
  toast("已收藏这套搭配");
}

function renderSavedOutfits() {
  if (!state.savedOutfits.length) {
    refs.savedOutfits.innerHTML = `<div class="empty-state">还没有收藏搭配。在“搭配”页生成推荐后，可以保存喜欢的组合。</div>`;
    return;
  }

  refs.savedOutfits.innerHTML = state.savedOutfits
    .map((outfit) => {
      const items = outfit.itemIds.map((id) => state.items.find((item) => item.id === id)).filter(Boolean);
      if (!items.length) return "";
      return `
        <article class="saved-card">
          <div class="outfit-gallery">
            ${items
              .map(
                (item) => `
                  <div class="saved-thumb" title="${escapeHtml(item.name)}">${renderItemImage(item)}</div>
                `,
              )
              .join("")}
          </div>
          <div class="saved-body">
            <div class="saved-title-row">
              <strong>${STYLE_LABELS[outfit.style]}方案</strong>
              <span class="score">${outfit.score} 分</span>
            </div>
            <div class="pill-row">
              <span class="pill">${outfit.weather.temp}°C</span>
              <span class="pill">${CONDITION_LABELS[outfit.weather.condition]}</span>
            </div>
            <div class="outfit-items">
              ${items.map((item) => `<span class="pill">${escapeHtml(item.name)}</span>`).join("")}
            </div>
            <button class="text-button danger" type="button" data-delete-saved="${outfit.id}">删除收藏</button>
          </div>
        </article>
      `;
    })
    .join("");

  refs.savedOutfits.querySelectorAll("[data-delete-saved]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedOutfits = state.savedOutfits.filter((outfit) => outfit.id !== button.dataset.deleteSaved);
      saveState();
      renderAll();
      toast("已删除收藏");
    });
  });
}

function clearSavedOutfits() {
  state.savedOutfits = [];
  saveState();
  renderAll();
  toast("已清空收藏方案");
}

async function fetchCityWeather() {
  const city = refs.cityInput.value.trim();
  if (!city) {
    toast("请输入城市名");
    return;
  }

  setWeatherLoading(true);
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
    const geo = await fetchJson(geoUrl);
    const result = geo.results?.[0];
    if (!result) throw new Error("没有找到城市");
    await updateWeatherFromCoordinates(result.latitude, result.longitude, result.name || city);
  } catch (error) {
    toast(`天气查询失败：${error.message}`);
  } finally {
    setWeatherLoading(false);
  }
}

function fetchGeoWeather() {
  if (!navigator.geolocation) {
    toast("当前浏览器不支持定位");
    return;
  }

  setWeatherLoading(true);
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await updateWeatherFromCoordinates(position.coords.latitude, position.coords.longitude, "当前位置");
      } catch (error) {
        toast(`天气查询失败：${error.message}`);
      } finally {
        setWeatherLoading(false);
      }
    },
    () => {
      setWeatherLoading(false);
      toast("定位失败，可改用城市或手动天气");
    },
    { enableHighAccuracy: false, timeout: 10000 },
  );
}

async function updateWeatherFromCoordinates(latitude, longitude, city) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,precipitation,wind_speed_10m&timezone=auto`;
  const data = await fetchJson(weatherUrl);
  const current = data.current;
  if (!current) throw new Error("没有返回实时天气");

  const condition = conditionFromWeatherCode(current.weather_code, current.precipitation, current.wind_speed_10m);
  state.weather = {
    temp: Math.round(current.temperature_2m),
    condition,
    city,
    updatedAt: new Date().toISOString(),
  };
  saveState();
  syncWeatherControls();
  renderAll();
  toast("已更新天气");
}

function saveManualWeather() {
  state.weather = {
    temp: Number(refs.manualTemp.value || 22),
    condition: refs.manualCondition.value,
    city: "手动天气",
    updatedAt: new Date().toISOString(),
  };
  saveState();
  syncWeatherControls();
  renderAll();
  toast("已保存手动天气");
}

function setWeatherLoading(isLoading) {
  refs.fetchWeatherBtn.disabled = isLoading;
  refs.geoWeatherBtn.disabled = isLoading;
  refs.fetchWeatherBtn.textContent = isLoading ? "查询中..." : "查询城市天气";
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`请求失败 ${response.status}`);
  return response.json();
}

function conditionFromWeatherCode(code, precipitation = 0, windSpeed = 0) {
  if (precipitation > 0.2) return "rain";
  if (windSpeed >= 30) return "wind";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";
  return "clear";
}

function renderWeather() {
  refs.weatherTemp.textContent = `${state.weather.temp}°C`;
  refs.weatherCondition.textContent = `${state.weather.city || "天气"} · ${CONDITION_LABELS[state.weather.condition]}`;
  const updated = state.weather.updatedAt ? new Date(state.weather.updatedAt).toLocaleString("zh-CN") : "尚未查询";
  refs.weatherMeta.textContent = `更新时间：${updated}`;
}

function syncWeatherControls() {
  refs.recommendTemp.value = state.weather.temp;
  refs.recommendCondition.value = state.weather.condition;
  refs.manualTemp.value = state.weather.temp;
  refs.manualCondition.value = state.weather.condition;
}

function seedWardrobe() {
  if (state.items.length && !confirm("会在现有衣橱中追加示例单品，是否继续？")) return;
  const examples = [
    ["白色牛津衬衫", "top", "white", "medium", "commute", "all", ["棉质", "利落"]],
    ["黑色针织衫", "top", "black", "warm", "casual", "winter", ["柔软", "常穿"]],
    ["浅蓝牛仔裤", "bottom", "denim", "medium", "casual", "all", ["直筒", "常穿"]],
    ["灰色西裤", "bottom", "gray", "medium", "commute", "all", ["垂顺", "正式"]],
    ["卡其风衣", "outer", "beige", "medium", "commute", "spring", ["防风", "雨天可穿"]],
    ["黑色短靴", "shoes", "black", "warm", "commute", "winter", ["防水"]],
    ["白色运动鞋", "shoes", "white", "light", "casual", "all", ["轻便", "常穿"]],
    ["绿色连衣裙", "dress", "green", "light", "date", "summer", ["清爽"]],
    ["棕色皮带", "accessory", "brown", "medium", "commute", "all", ["点缀"]],
  ].map(([name, category, color, warmth, style, season, tags]) => ({
    id: uid(),
    name,
    category,
    color,
    warmth,
    style,
    season,
    tags,
    rainReady: tags.some((tag) => tag.includes("防水") || tag.includes("雨")),
    favorite: tags.includes("常穿"),
    image: placeholderDataImage(color, category),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  state.items.unshift(...examples);
  saveState();
  renderAll();
  toast("已载入示例衣橱");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `smart-wardrobe-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      state.items = Array.isArray(imported.items) ? imported.items : [];
      state.savedOutfits = Array.isArray(imported.savedOutfits) ? imported.savedOutfits : [];
      state.weather = imported.weather || state.weather;
      saveState();
      syncWeatherControls();
      renderAll();
      toast("已导入衣橱数据");
    } catch {
      toast("导入失败，文件格式不正确");
    } finally {
      refs.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

function uniqueOutfit() {
  const seen = new Set();
  return (outfit) => {
    const key = outfit.items
      .map((item) => item.id)
      .sort()
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

function hueSpread(hues) {
  if (hues.length <= 1) return 0;
  return Math.max(...huePairs(hues));
}

function huePairs(hues) {
  const diffs = [];
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const raw = Math.abs(hues[i] - hues[j]);
      diffs.push(Math.min(raw, 360 - raw));
    }
  }
  return diffs;
}

function colorLabel(colorKey) {
  return COLORS[colorKey]?.label || "未设色";
}

function placeholderBackground(colorKey) {
  const hex = COLORS[colorKey]?.hex || "#dfe6e3";
  return `linear-gradient(135deg, ${hex}, #ffffff 115%)`;
}

function placeholderDataImage(colorKey, category) {
  const hex = COLORS[colorKey]?.hex || "#dfe6e3";
  const dark = "#1f2528";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
      <rect width="720" height="720" fill="#f8faf9"/>
      <circle cx="580" cy="110" r="78" fill="${hex}" opacity="0.28"/>
      <circle cx="100" cy="620" r="92" fill="${hex}" opacity="0.22"/>
      ${garmentShape(category, hex, dark)}
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function garmentShape(category, fill, stroke) {
  if (category === "shoes") {
    return `<path d="M155 420c88 22 151 8 205-42 21 43 78 73 166 91 45 10 72 32 79 68 4 21-11 41-33 42H170c-44 0-73-27-72-68 1-47 23-79 57-91Z" fill="${fill}" stroke="${stroke}" stroke-width="12" stroke-linejoin="round"/>`;
  }
  if (category === "bottom") {
    return `<path d="M254 126h214l37 465c3 33-18 56-49 56h-51l-47-319-47 319h-51c-31 0-52-23-49-56l43-465Z" fill="${fill}" stroke="${stroke}" stroke-width="12" stroke-linejoin="round"/>`;
  }
  if (category === "outer") {
    return `<path d="M253 132h214l109 131-76 83-36-39v304c0 28-22 50-50 50H306c-28 0-50-22-50-50V307l-36 39-76-83 109-131Z" fill="${fill}" stroke="${stroke}" stroke-width="12" stroke-linejoin="round"/><path d="M360 150v499" stroke="${stroke}" stroke-width="10"/>`;
  }
  if (category === "dress") {
    return `<path d="M280 122h160l51 166 91 294c10 33-13 65-47 65H185c-34 0-57-32-47-65l91-294 51-166Z" fill="${fill}" stroke="${stroke}" stroke-width="12" stroke-linejoin="round"/><path d="M279 122c24 37 138 37 162 0" fill="none" stroke="${stroke}" stroke-width="12"/>`;
  }
  if (category === "accessory") {
    return `<circle cx="360" cy="360" r="174" fill="none" stroke="${stroke}" stroke-width="26"/><path d="M239 481 481 239" stroke="${fill}" stroke-width="74" stroke-linecap="round"/><path d="M239 481 481 239" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>`;
  }
  return `<path d="M262 134h196l117 121-76 90-45-42v304c0 28-22 50-50 50h-88c-28 0-50-22-50-50V303l-45 42-76-90 117-121Z" fill="${fill}" stroke="${stroke}" stroke-width="12" stroke-linejoin="round"/><path d="M309 136c15 35 87 35 102 0" fill="none" stroke="${stroke}" stroke-width="12"/>`;
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => refs.toast.classList.remove("is-visible"), 2200);
}
