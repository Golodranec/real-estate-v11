// ======= v13.6 =======
console.log("✅ script.js v13.6 loaded");

const LS_OBJECTS = "objects";
const LS_FAVS    = "favorites_v13_6";

// ======= данные =======
let objects = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let editingId = null;
let selectedImages = [];
let tempCoords = { lat: null, lng: null };

// ======= всегда актуальные =======
function getTreeNodes() {
  return JSON.parse(localStorage.getItem("treeNodes") || "[]");
}
function getExtraParams() {
  return JSON.parse(localStorage.getItem("extraParams") || "[]");
}

// ======= helpers =======
const $ = (id) => document.getElementById(id);
const getNode = (id) => getTreeNodes().find(n => n.id === id) || null;
const childrenOf = (parentId) => getTreeNodes().filter(n => n.parent === parentId);
const typed = (type) => getTreeNodes().filter(n => n.type === type);
const nameById = (id) => (getNode(id)?.name) || "";
const num = v => (v==="" || v==null ? null : +v);

// ======= карта =======
const map = L.map("map").setView([41.3111, 69.2797], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);
let formMarker = null;

// ======= фильтры DOM =======
const cityFilter = $("cityFilter");
const districtFilter = $("districtFilter");
const streetFilter = $("streetFilter");
const categoryFilter = $("categoryFilter");
const statusFilter = $("statusFilter");
const priceMin = $("priceMin"), priceMax = $("priceMax");
const roomsMin = $("roomsMin"), roomsMax = $("roomsMax");
const floorMin = $("floorMin"), floorMax = $("floorMax");
const floorsMin= $("floorsMin"), floorsMax= $("floorsMax");
const areaMin  = $("areaMin"),  areaMax  = $("areaMax");
const yearMin  = $("yearMin"),  yearMax  = $("yearMax");
const houseTypeFilter = $("houseTypeFilter");
const sortSelect = $("sortSelect");
const onlyFav = $("onlyFav");
const resetFilters = $("resetFilters");
const filtersInfo = $("filtersInfo");
const paramsFiltersBox = $("dynamicParamsFilters");
const adminSyncInfo = $("adminSyncInfo");

// ======= форма DOM =======
const resultsList   = $("resultsList");
const form          = $("objectForm");
const formTitle     = $("formTitle");
const titleInput    = $("title");
const priceInput    = $("price");
const roomsInput    = $("rooms");
const statusInput   = $("status");
const categoryInput = $("category");
const addressInput  = $("address");
const areaInput     = $("area");
const floorInput    = $("floor");
const floorsInput   = $("floors");
const yearInput     = $("year");
const houseTypeSel  = $("houseType");
const imagesInput   = $("images");
const imagePreview  = $("imagePreview");
const pickOnMapBtn  = $("pickOnMap");
const coordsBadge   = $("coordsBadge");
const cancelEditBtn = $("cancelEdit");
const clearFormBtn  = $("clearForm");
const citySel = $("city");
const districtSel = $("district");
const streetSel = $("street");

// ======= утилиты =======
function setOptions(select, items, placeholder) {
  const prev = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(n => {
    const opt = document.createElement("option");
    opt.value = String(n.id);
    opt.textContent = n.name;
    select.appendChild(opt);
  });
  if (prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}
function showInfo(msg) { filtersInfo.style.display = "block"; filtersInfo.textContent = msg; }
function hideInfo() { filtersInfo.style.display = "none"; }

// ======= каскад фильтров =======
function initCascadeFilters() {
  setOptions(cityFilter, typed("Город"), "Город");
  setOptions(districtFilter, [], "Район");
  setOptions(streetFilter, [], "Массив / улица");
  setOptions(categoryFilter, typed("Категория"), "Категория");

  cityFilter.onchange = () => {
    const id = cityFilter.value ? +cityFilter.value : null;
    setOptions(districtFilter, id ? childrenOf(id).filter(n=>n.type==="Район") : [], "Район");
    setOptions(streetFilter, [], "Массив / улица");
    buildParamsFilters(); renderAll();
  };
  districtFilter.onchange = () => {
    const id = districtFilter.value ? +districtFilter.value : null;
    setOptions(streetFilter, id ? childrenOf(id).filter(n=>n.type==="Массив / улица") : [], "Массив / улица");
    renderAll();
  };
  streetFilter.onchange = () => { renderAll(); };
  categoryFilter.onchange = () => { buildParamsFilters(); renderAll(); };
  statusFilter.onchange = () => { renderAll(); };
  houseTypeFilter.onchange = () => { renderAll(); };
}

// ======= каскад формы =======
function initCascadeForm() {
  setOptions(citySel, typed("Город"), "Город");
  setOptions(districtSel, [], "Район");
  setOptions(streetSel, [], "Массив / улица");
  setOptions(categoryInput, typed("Категория"), "Категория");

  citySel.onchange = () => {
    const id = citySel.value ? +citySel.value : null;
    setOptions(districtSel, id ? childrenOf(id).filter(n=>n.type==="Район") : [], "Район");
    setOptions(streetSel, [], "Массив / улица");
  };
  districtSel.onchange = () => {
    const id = districtSel.value ? +districtSel.value : null;
    setOptions(streetSel, id ? childrenOf(id).filter(n=>n.type==="Массив / улица") : [], "Массив / улица");
  };

  categoryInput.onchange = () => { renderParamsForm(); };
  renderParamsForm();
}

// ======= динамические параметры =======
function paramsByCategoryId(catId) {
  return getExtraParams().filter(p => p.categoryId === catId);
}
function renderParamsForm() {
  const box = $("dynamicParamsForm");
  box.innerHTML = "";
  const catId = categoryInput.value ? +categoryInput.value : null;
  if (!catId) return;

  const params = paramsByCategoryId(catId);
  params.forEach(p => {
    const group = document.createElement("div");
    group.className = "param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div");
    vals.className = "param-values";
    (p.values||[]).forEach(val => {
      const chip = document.createElement("label");
      chip.className = "param-chip";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}" /> <span>${val}</span>`;
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    box.appendChild(group);
  });
}
function buildParamsFilters() {
  paramsFiltersBox.innerHTML = "";
  const catId = categoryFilter.value ? +categoryFilter.value : null;
  if (!catId) return;

  const params = paramsByCategoryId(catId);
  params.forEach(p => {
    const group = document.createElement("div");
    group.className = "param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div");
    vals.className = "param-values";
    (p.values||[]).forEach(val => {
      const chip = document.createElement("label");
      chip.className = "param-chip";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}" /> <span>${val}</span>`;
      chip.querySelector("input").addEventListener("change", ()=>{ renderAll(); });
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    paramsFiltersBox.appendChild(group);
  });
}

// ======= индикатор =======
function updateAdminSyncInfo() {
  const cats = typed("Категория").length;
  const params = getExtraParams().length;
  if (cats || params) {
    adminSyncInfo.style.color = "#4dff91";
    adminSyncInfo.textContent = `✔ Синхронизировано: ${cats} категорий, ${params} параметров`;
  } else {
    adminSyncInfo.style.color = "#ff6b6b";
    adminSyncInfo.textContent = "✖ Нет данных из админки";
  }
}

// ======= фильтрация =======
function applyFilters(list) {
  let res = [...list];
  const categoryName = categoryFilter.value ? nameById(+categoryFilter.value) : "";

  if (categoryName) res = res.filter(o => (o.category||"") === categoryName);

  const selectedByParam = {};
  paramsFiltersBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    if (cb.checked) {
      const p = cb.dataset.param;
      if (!selectedByParam[p]) selectedByParam[p] = new Set();
      selectedByParam[p].add(cb.value);
    }
  });
  Object.keys(selectedByParam).forEach(pname=>{
    const wanted = selectedByParam[pname];
    res = res.filter(o => {
      const got = new Set(o.extra?.[pname] || []);
      for (const val of wanted) { if (got.has(val)) return true; }
      return false;
    });
  });

  return res;
}

// ======= init =======
function init() {
  initCascadeFilters();
  initCascadeForm();
  buildParamsFilters();
  updateAdminSyncInfo();
  renderAll();
}
init();
