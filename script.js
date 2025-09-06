// ======= v13.5 =======
console.log("✅ script.js v13.5 loaded");

// ======= Константы LS =======
const LS_OBJECTS = "objects";
const LS_FILTERS = "filters_v13_5";
const LS_FAVS    = "favorites_v13_5";

// ======= Данные =======
let objects = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let editingId = null;
let selectedImages = [];
let tempCoords = { lat: null, lng: null };

// ======= Дерево/типы/параметры из админки =======
let treeNodes = JSON.parse(localStorage.getItem("treeNodes") || "[]");  // [{id,name,type,parent}]
let nodeTypes = JSON.parse(localStorage.getItem("nodeTypes") || "[]");  // ["Город","Район","Массив / улица","Категория",...]
let extraParams = JSON.parse(localStorage.getItem("extraParams") || "[]"); // [{id,name,categoryId,values:[...] }]

const defaultTypes = ["Город", "Район", "Массив / улица", "Категория"];
defaultTypes.forEach(t => { if (!nodeTypes.includes(t)) nodeTypes.push(t); });

// ======= helpers =======
const $ = (id) => document.getElementById(id);
const getNode = (id) => treeNodes.find(n => n.id === id) || null;
const childrenOf = (parentId) => treeNodes.filter(n => n.parent === parentId);
const typed = (type) => treeNodes.filter(n => n.type === type);
const nameById = (id) => (getNode(id)?.name) || "";

// ======= карта =======
const map = L.map("map").setView([41.3111, 69.2797], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);
let formMarker = null;

// ======= элементы =======
// фильтры
const cityFilter     = $("cityFilter");
const districtFilter = $("districtFilter");
const streetFilter   = $("streetFilter");
const categoryFilter = $("categoryFilter");
const statusFilter   = $("statusFilter");

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

// экспорт/импорт
const exportJsonBtn = $("exportJson");
const importJsonBtn = $("importJsonBtn");
const importJsonInp = $("importJson");
const exportCsvBtn  = $("exportCsv");

// список/форма
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

// локация в форме
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
const num = v => (v==="" || v==null ? null : +v);

// ======= Каскад фильтров =======
function initCascadeFilters() {
  if (!treeNodes.length) {
    showInfo("Нет данных из админки. Открой ‘Админка’ и добавь Город → Район → Массив / улица, а также Категории.");
  } else hideInfo();

  setOptions(cityFilter, typed("Город"), "Город");
  setOptions(districtFilter, [], "Район");
  setOptions(streetFilter, [], "Массив / улица");
  setOptions(categoryFilter, typed("Категория"), "Категория");

  cityFilter.onchange = () => {
    const id = cityFilter.value ? +cityFilter.value : null;
    setOptions(districtFilter, id ? childrenOf(id).filter(n=>n.type==="Район") : [], "Район");
    setOptions(streetFilter, [], "Массив / улица");
    buildParamsFilters(); saveFilters(); renderAll();
  };
  districtFilter.onchange = () => {
    const id = districtFilter.value ? +districtFilter.value : null;
    setOptions(streetFilter, id ? childrenOf(id).filter(n=>n.type==="Массив / улица") : [], "Массив / улица");
    saveFilters(); renderAll();
  };
  streetFilter.onchange = () => { saveFilters(); renderAll(); };
  categoryFilter.onchange = () => { buildParamsFilters(); saveFilters(); renderAll(); };
  statusFilter.onchange = () => { saveFilters(); renderAll(); };
  houseTypeFilter.onchange = () => { saveFilters(); renderAll(); };
}

// ======= Каскад формы =======
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

// ======= Динамические параметры: формы =======
function paramsByCategoryId(catId) {
  return extraParams.filter(p => p.categoryId === catId);
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
      const id = `pf_${p.id}_${val}`;
      chip.innerHTML = `<input type="checkbox" id="${id}" data-param="${p.name}" value="${val}" /> <span>${val}</span>`;
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    box.appendChild(group);
  });
}

// ======= Динамические параметры: фильтры =======
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
      const id = `fl_${p.id}_${val}`;
      const chip = document.createElement("label");
      chip.className = "param-chip";
      chip.innerHTML = `<input type="checkbox" id="${id}" data-param="${p.name}" value="${val}" /> <span>${val}</span>`;
      chip.querySelector("input").addEventListener("change", ()=>{ saveFilters(); renderAll(); });
      vals.appendChild(chip);
    });
    group.appendChild(vals);
    paramsFiltersBox.appendChild(group);
  });

  // восстановить сохранённые значения фильтра
  const s = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
  paramsFiltersBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    const key = `param_${cb.dataset.param}_${cb.value}`;
    if (s[key]) cb.checked = true;
  });
}

// ======= сохранение/загрузка фильтров =======
function loadFilters() {
  const s = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
  ["cityFilter","districtFilter","streetFilter","categoryFilter","statusFilter","houseTypeFilter"].forEach(k => { if (s[k]) $(k).value = s[k]; });
  ["priceMin","priceMax","roomsMin","roomsMax","floorMin","floorMax","floorsMin","floorsMax","areaMin","areaMax","yearMin","yearMax","sortSelect"]
    .forEach(k => { if (s[k] != null) $(k).value = s[k]; });
  onlyFav.checked = !!s.onlyFav;

  // отрисовать чекбоксы параметров под выбранную категорию и восстановить состояния
  buildParamsFilters();
}
function saveFilters() {
  const s = {
    cityFilter: cityFilter.value, districtFilter: districtFilter.value, streetFilter: streetFilter.value, categoryFilter: categoryFilter.value,
    statusFilter: statusFilter.value, houseTypeFilter: houseTypeFilter.value,
    priceMin: priceMin.value, priceMax: priceMax.value, roomsMin: roomsMin.value, roomsMax: roomsMax.value,
    floorMin: floorMin.value, floorMax: floorMax.value, floorsMin: floorsMin.value, floorsMax: floorsMax.value,
    areaMin: areaMin.value, areaMax: areaMax.value, yearMin: yearMin.value, yearMax: yearMax.value,
    sortSelect: sortSelect.value, onlyFav: onlyFav.checked
  };
  paramsFiltersBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    const key = `param_${cb.dataset.param}_${cb.value}`;
    s[key] = cb.checked;
  });
  localStorage.setItem(LS_FILTERS, JSON.stringify(s));
}

// ======= фотки =======
imagesInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => { selectedImages.push(ev.target.result); renderImagePreview(); };
    reader.readAsDataURL(file);
  });
  imagesInput.value = "";
});
function renderImagePreview() {
  imagePreview.innerHTML = "";
  selectedImages.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-item";
    wrap.innerHTML = `<img src="${src}" /><button type="button">✕</button>`;
    wrap.querySelector("button").addEventListener("click", () => { selectedImages.splice(idx, 1); renderImagePreview(); });
    imagePreview.appendChild(wrap);
  });
}

// ======= выбор точки на карте =======
pickOnMapBtn.addEventListener("click", () => {
  pickOnMapBtn.disabled = true; pickOnMapBtn.textContent = "Кликни по карте…";
  const once = (ev) => {
    tempCoords = { lat: +ev.latlng.lat.toFixed(6), lng: +ev.latlng.lng.toFixed(6) };
    coordsBadge.textContent = `Выбрано: ${tempCoords.lat}, ${tempCoords.lng}`;
    coordsBadge.classList.remove("muted");
    if (formMarker) markerLayer.removeLayer(formMarker);
    formMarker = L.marker([tempCoords.lat, tempCoords.lng]).addTo(markerLayer);
    map.off("click", once);
    pickOnMapBtn.disabled = false; pickOnMapBtn.textContent = "Поставить точку на карте";
  };
  map.on("click", once);
});

// ======= сохранение / редактирование =======
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const base = editingId ? objects.find(o => o.id === editingId) : null;

  const cityId = citySel.value ? +citySel.value : null;
  const districtId = districtSel.value ? +districtSel.value : null;
  const streetId = streetSel.value ? +streetSel.value : null;

  // собрать extra из чекбоксов формы
  const extra = {};
  document.querySelectorAll('#dynamicParamsForm input[type="checkbox"]').forEach(cb=>{
    const pname = cb.dataset.param;
    if (cb.checked) {
      if (!extra[pname]) extra[pname] = [];
      extra[pname].push(cb.value);
    }
  });

  const obj = {
    id: editingId ?? Date.now(),
    title: titleInput.value.trim(),
    price: priceInput.value ? +priceInput.value : null,
    rooms: roomsInput.value ? +roomsInput.value : null,
    status: statusInput.value, // sale/rent/exchange
    category: categoryInput.value ? (getNode(+categoryInput.value)?.name || "") : "",
    city: cityId ? (getNode(cityId)?.name || "") : "",
    district: districtId ? (getNode(districtId)?.name || "") : "",
    street: streetId ? (getNode(streetId)?.name || "") : "",
    address: addressInput.value.trim(),
    area: areaInput.value ? +areaInput.value : null,
    floor: floorInput.value ? +floorInput.value : null,
    floors: floorsInput.value ? +floorsInput.value : null,
    year: yearInput.value ? +yearInput.value : null,
    houseType: houseTypeSel.value || null,
    extra, // <— ключ
    lat: tempCoords.lat,
    lng: tempCoords.lng,
    images: [...selectedImages],
    createdAt: base ? base.createdAt : Date.now()
  };

  if (editingId) { objects = objects.map(o => o.id === editingId ? obj : o); }
  else { objects.push(obj); }
  localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
  clearFormState(); renderAll();
});

cancelEditBtn.addEventListener("click", clearFormState);
clearFormBtn.addEventListener("click", () => { form.reset(); selectedImages=[]; tempCoords={lat:null,lng:null}; renderImagePreview(); initCascadeForm(); });

// ======= clearFormState =======
function clearFormState() {
  form.reset(); editingId = null; selectedImages = []; tempCoords = { lat:null, lng:null };
  coordsBadge.textContent = "Координаты не выбраны"; coordsBadge.classList.add("muted");
  renderImagePreview(); formTitle.textContent = "Добавить объект";
  if (formMarker) { markerLayer.removeLayer(formMarker); formMarker = null; }
  initCascadeForm();
}

// ======= избранное =======
function toggleFav(id) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  localStorage.setItem(LS_FAVS, JSON.stringify([...favorites]));
  renderAll();
}
function isFav(id) { return favorites.has(id); }

// ======= фильтрация =======
function applyFilters(list) {
  let res = [...list];

  const cityName = cityFilter.value ? nameById(+cityFilter.value) : "";
  const districtName = districtFilter.value ? nameById(+districtFilter.value) : "";
  const streetName = streetFilter.value ? nameById(+streetFilter.value) : "";
  const categoryName = categoryFilter.value ? nameById(+categoryFilter.value) : "";
  const statusVal = statusFilter.value || "";

  if (cityName)     res = res.filter(o => (o.city||"")     === cityName);
  if (districtName) res = res.filter(o => (o.district||"") === districtName);
  if (streetName)   res = res.filter(o => (o.street||"")   === streetName);
  if (categoryName) res = res.filter(o => (o.category||"") === categoryName);
  if (statusVal)    res = res.filter(o => (o.status||"")   === statusVal);

  // тип дома
  if (houseTypeFilter.value) res = res.filter(o => (o.houseType||"") === houseTypeFilter.value);

  // динамические параметры (чекбоксы): внутри одного параметра — ИЛИ, между параметрами — И
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
      // пересечение множеств
      for (const val of wanted) { if (got.has(val)) return true; }
      return false;
    });
  });

  const pMin = num(priceMin.value), pMax = num(priceMax.value);
  const rMin = num(roomsMin.value), rMax = num(roomsMax.value);
  const fMin = num(floorMin.value), fMax = num(floorMax.value);
  const fsMin= num(floorsMin.value), fsMax= num(floorsMax.value);
  const aMin = num(areaMin.value),  aMax = num(areaMax.value);
  const yMin = num(yearMin.value),  yMax = num(yearMax.value);

  if (pMin!==null) res = res.filter(o => (o.price ?? Infinity) >= pMin);
  if (pMax!==null) res = res.filter(o => (o.price ?? -Infinity) <= pMax);
  if (rMin!==null) res = res.filter(o => (o.rooms ?? Infinity) >= rMin);
  if (rMax!==null) res = res.filter(o => (o.rooms ?? -Infinity) <= rMax);
  if (fMin!==null) res = res.filter(o => (o.floor ?? Infinity) >= fMin);
  if (fMax!==null) res = res.filter(o => (o.floor ?? -Infinity) <= fMax);
  if (fsMin!==null) res = res.filter(o => (o.floors ?? Infinity) >= fsMin);
  if (fsMax!==null) res = res.filter(o => (o.floors ?? -Infinity) <= fsMax);
  if (aMin!==null) res = res.filter(o => (o.area ?? Infinity) >= aMin);
  if (aMax!==null) res = res.filter(o => (o.area ?? -Infinity) <= aMax);
  if (yMin!==null) res = res.filter(o => (o.year ?? Infinity) >= yMin);
  if (yMax!==null) res = res.filter(o => (o.year ?? -Infinity) <= yMax);

  if (onlyFav.checked) res = res.filter(o => favorites.has(o.id));

  if (sortSelect.value==="priceAsc") res.sort((a,b)=> (a.price??0)-(b.price??0));
  if (sortSelect.value==="priceDesc")res.sort((a,b)=> (b.price??0)-(a.price??0));
  if (sortSelect.value==="dateNew")  res.sort((a,b)=> (b.createdAt??0)-(a.createdAt??0));
  if (sortSelect.value==="dateOld")  res.sort((a,b)=> (a.createdAt??0)-(b.createdAt??0));

  return res;
}

[
  priceMin,priceMax,roomsMin,roomsMax,floorMin,floorMax,floorsMin,floorsMax,areaMin,areaMax,yearMin,yearMax,sortSelect,onlyFav,
  statusFilter, houseTypeFilter
].forEach(el => el.addEventListener("input", () => { saveFilters(); renderAll(); }));

resetFilters.addEventListener("click", () => {
  [cityFilter,districtFilter,streetFilter,categoryFilter,statusFilter,houseTypeFilter,
   priceMin,priceMax,roomsMin,roomsMax,floorMin,floorMax,floorsMin,floorsMax,areaMin,areaMax,yearMin,yearMax,sortSelect]
   .forEach(el => el.value = "");
  onlyFav.checked = false;
  saveFilters();
  initCascadeFilters();
  buildParamsFilters();
  renderAll();
});

// ======= рендер =======
function renderAll() {
  const list = applyFilters(objects);
  renderList(list);
  renderMap(list);
}
function renderList(list){
  resultsList.innerHTML="";
  if (!list.length) {
    const d = document.createElement("div");
    d.className="card-item"; d.innerHTML = `<div class="card-body">Ничего не найдено</div>`;
    resultsList.appendChild(d); return;
  }
  list.forEach(obj=>{
    const card=document.createElement("article");
    card.className="card-item"; card.id=`card-${obj.id}`;
    const img0=obj.images?.[0]||""; const total=obj.images?.length||0;
    const addr = [obj.city,obj.district,obj.street].filter(Boolean).join(", ");
    const extras = obj.extra ? Object.entries(obj.extra).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(", "):v}`).join(" · ") : "";
    card.innerHTML=`
      <div class="slider"><img src="${img0}" style="${img0?'':'display:none'}"/><div class="count">${total?`1/${total}`:"без фото"}</div></div>
      <div class="card-body">
        <div class="card-title">${obj.title || "(без названия)"}</div>
        <div class="card-meta"><span>Цена: ${obj.price!=null?obj.price.toLocaleString():"—"}</span><span>Комнат: ${obj.rooms??"—"}</span></div>
        <div class="card-meta"><span>Категория: ${obj.category||"—"}</span><span>Статус: ${obj.status||"—"}</span></div>
        <div class="card-meta"><span>${addr || "—"}</span></div>
        <div class="card-meta">
          ${obj.area?`<span>Площадь: ${obj.area} м²</span>`:""}
          ${obj.floor!=null||obj.floors!=null?`<span>Этаж/этажность: ${obj.floor??"—"} / ${obj.floors??"—"}</span>`:""}
          ${obj.year?`<span>Год: ${obj.year}</span>`:""}
          ${obj.houseType?`<span>Тип дома: ${obj.houseType}</span>`:""}
        </div>
        ${extras?`<div class="card-meta">${extras}</div>`:""}
        <div class="card-actions">
          <button class="btn" onclick="fillFormForEdit(${obj.id})">Редактировать</button>
          <button class="btn danger" onclick="deleteObj(${obj.id})">Удалить</button>
          <button class="fav-btn ${isFav(obj.id)?"active":""}" onclick="toggleFav(${obj.id})">♥</button>
        </div>
      </div>`;
    resultsList.appendChild(card);
  });
}
function renderMap(list){
  cluster.clearLayers();
  list.forEach(obj=>{
    if(obj.lat==null||obj.lng==null)return;
    const m=L.marker([obj.lat,obj.lng]);
    const addr = [obj.city,obj.district,obj.street].filter(Boolean).join(", ");
    m.bindPopup(`<b>${obj.title || "(без названия)"}</b><br>${obj.price!=null?obj.price.toLocaleString():"—"}$<br>${addr}`);
    cluster.addLayer(m);
  });
}

// ======= редактирование =======
window.fillFormForEdit = function(id){
  const o=objects.find(x=>x.id===id); if(!o) return;
  editingId=o.id;
  titleInput.value=o.title||""; priceInput.value=o.price??""; roomsInput.value=o.rooms??"";
  statusInput.value=o.status||"sale";

  // категория
  setOptions(categoryInput, typed("Категория"), "Категория");
  const catNode = typed("Категория").find(n => n.name === o.category);
  if (catNode) categoryInput.value = String(catNode.id);

  addressInput.value=o.address||"";
  areaInput.value=o.area??""; floorInput.value=o.floor??""; floorsInput.value=o.floors??""; yearInput.value=o.year??""; houseTypeSel.value=o.houseType||"";
  selectedImages=[...(o.images||[])]; renderImagePreview();
  tempCoords={lat:o.lat,lng:o.lng};

  // локация
  const cityN = typed("Город").find(n=>n.name===o.city);
  setOptions(citySel, typed("Город"), "Город");
  if (cityN) citySel.value = String(cityN.id);
  const distN = cityN ? childrenOf(cityN.id).find(n=>n.type==="Район" && n.name===o.district) : null;
  setOptions(districtSel, cityN?childrenOf(cityN.id).filter(n=>n.type==="Район"):[], "Район");
  if (distN) districtSel.value = String(distN.id);
  const streetN = distN ? childrenOf(distN.id).find(n=>n.type==="Массив / улица" && n.name===o.street) : null;
  setOptions(streetSel, distN?childrenOf(distN.id).filter(n=>n.type==="Массив / улица"):[], "Массив / улица");
  if (streetN) streetSel.value = String(streetN.id);

  // параметры категории — отрисовать и отметить выбранные
  renderParamsForm();
  if (o.extra) {
    document.querySelectorAll('#dynamicParamsForm input[type="checkbox"]').forEach(cb=>{
      const pname = cb.dataset.param;
      if (o.extra[pname]?.includes(cb.value)) cb.checked = true;
    });
  }

  formTitle.textContent="Редактировать объект";
}
window.deleteObj = function(id){
  objects=objects.filter(o=>o.id!==id);
  favorites.delete(id);
  localStorage.setItem(LS_OBJECTS,JSON.stringify(objects));
  localStorage.setItem(LS_FAVS,JSON.stringify([...favorites]));
  renderAll();
}

// ======= экспорт / импорт =======
exportJsonBtn.addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects, null, 2));
  const dl = document.createElement("a"); dl.href = dataStr;
  dl.download = "objects_" + new Date().toISOString().slice(0,10) + ".json"; dl.click();
});
importJsonBtn.addEventListener("click", () => importJsonInp.click());
importJsonInp.addEventListener("change", (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try { const data = JSON.parse(ev.target.result); if (Array.isArray(data)) { objects = data; localStorage.setItem(LS_OBJECTS, JSON.stringify(objects)); renderAll(); alert("Импортировано: " + objects.length); } else alert("Неверный формат файла"); }
    catch (err) { alert("Ошибка JSON: " + err.message); }
  };
  reader.readAsText(file); e.target.value = "";
});
exportCsvBtn.addEventListener("click", () => {
  if (!objects.length) return alert("Нет объектов");
  const headers = ["id","title","price","rooms","status","category","city","district","street","address","area","floor","floors","year","houseType","lat","lng","createdAt","extra"];
  const rows = objects.map(o => {
    const row = {...o, extra: JSON.stringify(o.extra||{})};
    return headers.map(h => JSON.stringify(row[h] ?? "")).join(",");
  });
  const csv = headers.join(",") + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dl = document.createElement("a"); dl.href = url; dl.download = "objects_" + new Date().toISOString().slice(0,10) + ".csv"; dl.click();
  URL.revokeObjectURL(url);
});

// ======= init =======
function init() {
  initCascadeFilters();
  initCascadeForm();
  loadFilters();
  renderAll();

  // демо, если пусто
  if (!objects.length) {
    const demoCity = typed("Город")[0];
    const demoDist = demoCity ? childrenOf(demoCity.id).find(n=>n.type==="Район") : null;
    const demoStreet = demoDist ? childrenOf(demoDist.id).find(n=>n.type==="Массив / улица") : null;
    const catFlat = typed("Категория").find(n=>n.name==="Квартиры") || typed("Категория")[0];

    objects = [
      { id: Date.now(), title:"Квартира (демо)", price:50000, rooms:3, status:"sale",
        category: catFlat?catFlat.name:"", city: demoCity?demoCity.name:"", district: demoDist?demoDist.name:"", street: demoStreet?demoStreet.name:"",
        area:67, floor:4, floors:9, lat:41.31, lng:69.28, images:[], createdAt: Date.now(),
        year: 2005, houseType: "panel", extra: {}
      }
    ];
    localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
    renderAll();
  }
}
init();
