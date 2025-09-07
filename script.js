// ======= v13.9.3 =======
console.log("✅ script.js v13.9.3 loaded");

// keys
const LS_OBJECTS = "objects";
const LS_FAVS    = "favorites_v13_9_3";

// state
let objects   = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let selectedImages = []; // {name,size,dataUrl}
let tempCoords = null;   // {lat,lng}
let pickMode = false;
let tempMarker = null;   // временный маркер

// storage getters
const getTreeNodes   = () => JSON.parse(localStorage.getItem("treeNodes")   || "[]");
const getNodeTypes   = () => JSON.parse(localStorage.getItem("nodeTypes")   || "[]");
const getExtraParams = () => JSON.parse(localStorage.getItem("extraParams") || "[]");

// helpers
const $ = id => document.getElementById(id);
const nameById = (id) => (getTreeNodes().find(n => n.id === id)?.name) || "";
const detectCategoryType = () => {
  const types = getNodeTypes();
  const exact = types.find(t => t.trim().toLowerCase() === "категория");
  if (exact) return exact;
  const byWord = types.find(t => /кат|тип|category/i.test(t));
  return byWord || types[0] || null;
};
const fmtNum = (n) => (isFinite(n) && n>0) ? Number(n).toLocaleString() : "";

// map
const map = L.map("map").setView([41.3111, 69.2797], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, attribution:"© OpenStreetMap"}).addTo(map);
const cluster = L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:45 });
map.addLayer(cluster);

// =============== BUILD FILTERS =================
function buildFilters() {
  const box = $("filtersBox");
  if (!box) return;
  box.innerHTML = "";

  const types = getNodeTypes();
  const nodes = getTreeNodes();

  // селекты по каждому типу
  types.forEach(typeName => {
    const sel = document.createElement("select");
    sel.id = `filter_${typeName}`;
    sel.innerHTML = `<option value="">${typeName}</option>`;
    nodes.filter(n => n.type === typeName).forEach(n => {
      const o = document.createElement("option");
      o.value = n.id;
      o.textContent = n.name;
      sel.appendChild(o);
    });
    sel.onchange = () => { buildParamsFilters(); renderAll(); };
    box.appendChild(sel);
  });

  // статус
  const status = document.createElement("select");
  status.id = "filter_status";
  status.innerHTML = `
    <option value="">Статус</option>
    <option value="sale">Продается</option>
    <option value="rent">Сдается</option>
    <option value="exchange">Обмен</option>`;
  status.onchange = renderAll;
  box.appendChild(status);

  // сброс
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сбросить";
  resetBtn.className = "btn ghost";
  resetBtn.onclick = () => { buildFilters(); renderAll(); };
  box.appendChild(resetBtn);

  // служебные блоки
  const sync = document.createElement("div");
  sync.id = "adminSyncInfo"; sync.className = "hint"; sync.style.gridColumn = "1/-1";
  box.appendChild(sync);

  const dyn = document.createElement("div");
  dyn.id = "dynamicParamsFilters"; dyn.className = "params-box"; dyn.style.gridColumn = "1/-1";
  box.appendChild(dyn);

  const statusText = document.createElement("div");
  statusText.id = "scriptStatus"; statusText.className = "hint";
  statusText.style.gridColumn = "1/-1"; statusText.style.color = "#4dff91";
  statusText.textContent = "✔ Скрипт загружен";
  box.appendChild(statusText);

  // параметры по выбранной категории
  buildParamsFilters();
}
// ============ DYNAMIC PARAMS ===================
function paramsForCategoryNode(catNodeId) {
  return getExtraParams().filter(p => p.categoryId === catNodeId);
}
function currentCategoryNodeIdFromFilters() {
  const catType = detectCategoryType(); if (!catType) return null;
  const sel = $(`filter_${catType}`); if (!sel || !sel.value) return null;
  return +sel.value;
}
function buildParamsFilters() {
  const box = $("dynamicParamsFilters"); if (!box) return;
  box.innerHTML = "";

  const catId = currentCategoryNodeIdFromFilters();
  if (!catId) return;
  const list = paramsForCategoryNode(catId);

  const active = gatherActiveFilters().params;

  list.forEach(p => {
    const group = document.createElement("div");
    group.className = "param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div");
    vals.className = "param-values";
    (p.values||[]).forEach(val => {
      const chip = document.createElement("label");
      chip.className = "param-chip";
      const checked = active[p.name]?.has(val) ? "checked" : "";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}" ${checked}> <span>${val}</span>`;
      chip.querySelector("input").addEventListener("change", ()=>{
        const filtered = applyFilters(objects);
        renderMarkers(filtered);
        renderResults(filtered);
      });
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    box.appendChild(group);
  });
}

// ============ BUILD FORM =======================
function buildForm() {
  const box = $("dynamicLocationForm"); if (!box) return;
  box.innerHTML = "";

  const types = getNodeTypes();
  const nodes = getTreeNodes();

  types.forEach(typeName => {
    const sel = document.createElement("select");
    sel.id = `form_${typeName}`;
    sel.innerHTML = `<option value="">${typeName}</option>`;
    nodes.filter(n => n.type === typeName).forEach(n => {
      const o = document.createElement("option");
      o.value = n.id;
      o.textContent = n.name;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      if (typeName === detectCategoryType()) renderParamsForm();
    };
    box.appendChild(sel);
  });
}
function currentCategoryNodeIdFromForm() {
  const catType = detectCategoryType(); if (!catType) return null;
  const sel = $(`form_${catType}`); if (!sel || !sel.value) return null;
  return +sel.value;
}
function renderParamsForm() {
  const box = $("dynamicParamsForm"); if (!box) return;
  box.innerHTML = "";
  const catId = currentCategoryNodeIdFromForm();
  if (!catId) return;
  const list = paramsForCategoryNode(catId);
  list.forEach(p => {
    const group = document.createElement("div");
    group.className = "param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div");
    vals.className = "param-values";
    (p.values||[]).forEach(val => {
      const chip = document.createElement("label");
      chip.className = "param-chip";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}"> <span>${val}</span>`;
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    box.appendChild(group);
  });
}

// ============= SYNC INDICATOR ==================
function updateAdminSyncInfo() {
  const types = getNodeTypes().length;
  const nodes = getTreeNodes().length;
  const params = getExtraParams().length;
  const el = $("adminSyncInfo"); if (!el) return;
  if (nodes || params) {
    el.style.color = "#4dff91";
    el.textContent = `✔ Синхронизировано: типов ${types}, узлов ${nodes}, параметров ${params}`;
  } else {
    el.style.color = "#ff6b6b";
    el.textContent = "✖ Нет данных из админки";
  }
}

// =============== IMAGES ========================
function dedupImages(arr){
  const seen=new Set();
  return arr.filter(f=>{
    const key = `${f.name}|${f.size}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function attachImagesHandler() {
  const input = $("images"); const preview = $("imagePreview");
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      selectedImages.push({ name:file.name, size:file.size, dataUrl });
    }
    selectedImages = dedupImages(selectedImages);
    renderImagePreview(preview);
    input.value = "";
  };
}
function fileToDataUrl(file){
  return new Promise(res=>{
    const fr=new FileReader();
    fr.onload=()=>res(fr.result);
    fr.readAsDataURL(file);
  });
}
function renderImagePreview(previewEl){
  previewEl.innerHTML = "";
  selectedImages.forEach(img=>{
    const el=document.createElement("img");
    el.src = img.dataUrl; el.alt = img.name;
    previewEl.appendChild(el);
  });
}

// ============ MAP: PICK POINT ==================
function attachPickOnMap() {
  const btn = $("pickOnMap"); const badge = $("coordsBadge");
  btn.onclick = () => {
    pickMode = true;
    badge.textContent = "Кликните по карте…";
    badge.style.background = "#444d";
  };
  map.on("click", (e) => {
    if (!pickMode) return;
    tempCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    badge.textContent = `Выбрано: ${tempCoords.lat.toFixed(5)}, ${tempCoords.lng.toFixed(5)}`;
    badge.style.background = "#242938";
    pickMode = false;

    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([tempCoords.lat, tempCoords.lng], { opacity: 0.6 });
    tempMarker.addTo(map);
  });
}
// =============== SAVE OBJECT ===================
function attachFormSubmit() {
  const form = $("objectForm");
  $("clearForm").onclick = () => { resetForm(); };

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const loc = {};
    getNodeTypes().forEach(t=>{
      const sel = $(`form_${t}`);
      if (sel && sel.value) loc[t] = +sel.value;
    });

    const extra = {};
    document.querySelectorAll('#dynamicParamsForm input[type="checkbox"]').forEach(cb=>{
      const pname = cb.dataset.param;
      if (!extra[pname]) extra[pname] = [];
      if (cb.checked) extra[pname].push(cb.value);
    });

    const obj = {
      id: Date.now(),
      status: $("form_status").value || "",
      title: $("title").value.trim(),
      address: $("address").value.trim(),
      price: +($("price").value || 0),
      area: +($("area").value || 0),
      rooms: +($("rooms").value || 0),
      floor: +($("floor").value || 0),
      floors: +($("floors").value || 0),
      year: +($("year").value || 0),
      loc,
      extra,
      images: selectedImages.slice(0),
      coords: tempCoords ? { ...tempCoords } : null,
      createdAt: Date.now()
    };

    objects.push(obj);
    localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
    localStorage.setItem("objects_last_change", String(Date.now()));

    resetForm();
    renderAll();
  };
}
function resetForm(){
  ["title","address","price","area","rooms","floor","floors","year"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
  getNodeTypes().forEach(t=>{ const el=$(`form_${t}`); if(el) el.value=""; });
  const st = $("form_status"); if (st) st.value = "sale";
  $("dynamicParamsForm").innerHTML = "";
  selectedImages = [];
  $("imagePreview").innerHTML = "";
  tempCoords = null;
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
  const badge = $("coordsBadge"); if (badge) { badge.textContent = "Координаты не выбраны"; }
}

// =============== FILTER APPLY ==================
function gatherActiveFilters() {
  const filters = { byType:{}, status:null, params:{} };
  getNodeTypes().forEach(t=>{
    const el = $(`filter_${t}`);
    if (el && el.value) filters.byType[t] = +el.value;
  });
  const st = $("filter_status");
  if (st && st.value) filters.status = st.value;

  document.querySelectorAll('#dynamicParamsFilters input[type="checkbox"]').forEach(cb=>{
    if (!cb.checked) return;
    const pname = cb.dataset.param;
    if (!filters.params[pname]) filters.params[pname] = new Set();
    filters.params[pname].add(cb.value);
  });
  return filters;
}
function applyFilters(list){
  const f = gatherActiveFilters();
  let res = list.slice();

  Object.entries(f.byType).forEach(([typeName,nodeId])=>{
    res = res.filter(o => (o.loc && o.loc[typeName] === nodeId));
  });

  if (f.status) res = res.filter(o => o.status === f.status);

  Object.entries(f.params).forEach(([pname, set])=>{
    res = res.filter(o => {
      const got = new Set(o.extra?.[pname] || []);
      for (const v of set) if (got.has(v)) return true;
      return false;
    });
  });

  return res;
}

// ============ MARKERS & RESULTS ================
function renderMarkers(list = objects) {
  cluster.clearLayers();
  list.forEach(o=>{
    if (!o.coords) return;

    const catType = detectCategoryType();
    const catName = catType && o.loc?.[catType] ? nameById(o.loc[catType]) : "";

    const pRooms = o.rooms ? `${o.rooms}` : "";
    const pArea  = o.area ? `${fmtNum(o.area)} м²` : "";
    const pFloor = (o.floor || o.floors) ? [o.floor?`этаж ${o.floor}`:"", o.floors?`из ${o.floors}`:""].filter(Boolean).join(" ") : "";
    const pYear  = o.year ? `${o.year}` : "";

    const thumbs = (o.images||[]).slice(0,2).map(im=>`<img src="${im.dataUrl}" alt="" style="width:56px;height:42px;object-fit:cover;border-radius:4px;margin-right:4px">`).join("");

    const html = `
      <div style="min-width:210px">
        <b>${o.title || "(без названия)"}</b> ${catName ? `<span class="badge">${catName}</span>`:""}<br/>
        ${o.price ? `<div class="price" style="margin:6px 0">${fmtNum(o.price)} сум</div>` : ""}
        ${pRooms ? `<div class="meta">Комнаты: ${pRooms}</div>` : ""}
        ${pArea  ? `<div class="meta">Площадь: ${pArea}</div>` : ""}
        ${pFloor ? `<div class="meta">Этажность: ${pFloor}</div>` : ""}
        ${pYear  ? `<div class="meta">Год: ${pYear}</div>` : ""}
        ${o.address ? `<div class="meta">${o.address}</div>` : ""}
        ${thumbs ? `<div style="margin-top:6px;display:flex;align-items:center">${thumbs}${o.images.length>2?`<span class="badge">+${o.images.length-2}</span>`:""}</div>`:""}
      </div>`;
    const m = L.marker([o.coords.lat, o.coords.lng]);
    m.bindPopup(html);
    cluster.addLayer(m);
  });
}
function renderResults(list = objects) {
  const wrap = $("resultsList"); wrap.innerHTML = "";
  if (!list.length) { wrap.innerHTML = `<div class="muted">Нет объектов</div>`; return; }

  list.forEach(o=>{
    const card = document.createElement("div");
    card.className = "item";
    const catType = detectCategoryType();
    const catName = catType && o.loc?.[catType] ? nameById(o.loc[catType]) : "";

    const pRooms = o.rooms ? `${o.rooms}` : "";
    const pArea  = o.area ? `${fmtNum(o.area)} м²` : "";
    const pFloor = (o.floor || o.floors) ? [o.floor?`этаж ${o.floor}`:"", o.floors?`из ${o.floors}`:""].filter(Boolean).join(" ") : "";
    const pYear  = o.year ? `${o.year}` : "";

    const maxThumbs = 8;
    const thumbs = (o.images||[]).slice(0,maxThumbs).map(im=>`<img src="${im.dataUrl}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:4px;margin:2px">`).join("");

    card.innerHTML = `
      <h3>${o.title || "(без названия)"} ${catName ? `<span class="badge">${catName}</span>`:""}</h3>
      <div class="price">${o.price ? `${fmtNum(o.price)} сум` : ""}</div>
      ${o.address ? `<div class="meta">${o.address}</div>` : ""}
      ${pRooms ? `<div class="meta">Комнаты: ${pRooms}</div>` : ""}
      ${pArea ? `<div class="meta">Площадь: ${pArea}</div>` : ""}
      ${pFloor ? `<div class="meta">Этажность: ${pFloor}</div>` : ""}
      ${pYear ? `<div class="meta">Год: ${pYear}</div>` : ""}
      ${thumbs ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap">${thumbs}${o.images.length>maxThumbs?`<span class="badge">+${o.images.length-maxThumbs}</span>`:""}</div>`:""}
    `;
    wrap.appendChild(card);
  });
}

// =============== RENDER ALL ====================
function renderAll() {
  updateAdminSyncInfo();
  const filtered = applyFilters(objects);
  renderMarkers(filtered);
  renderResults(filtered);
}

// =============== INIT ==========================
function init() {
  buildFilters();
  buildForm();
  attachImagesHandler();
  attachPickOnMap();
  attachFormSubmit();
  renderAll();
}
init();

// storage events
window.addEventListener("storage", e=>{
  if (e.key==="treeNodes" || e.key==="nodeTypes" || e.key==="extraParams") {
    buildFilters(); buildForm(); renderAll();
  }
  if (e.key==="objects") {
    objects = JSON.parse(localStorage.getItem(LS_OBJECTS)||"[]");
    renderAll();
  }
});
