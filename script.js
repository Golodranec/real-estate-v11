// ======= v13.2 bootstrap =======
console.log("✅ script.js v13.2 loaded");

// ======= Хранилища =======
const LS_OBJECTS = "objects";
const LS_FILTERS = "filters_v13_2";
const LS_FAVS    = "favorites_v13_1"; // совместимость со старым ключом

let objects = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let editingId = null;
let selectedImages = [];
let tempCoords = { lat: null, lng: null };

// ======= Тестовое древо локаций (район → квартал → улица/массив) =======
// при желании расширяешь этот массив — всё подтянется автоматом
const locations = [
  // Районы
  { id: 1, name: "Мирабадский район", parent: null },
  { id: 5, name: "Юнусабадский район", parent: null },

  // Кварталы
  { id: 2, name: "12-й квартал", parent: 1 },
  { id: 6, name: "15-й квартал", parent: 5 },

  // Улицы/массивы
  { id: 3, name: "ул. Навои", parent: 2 },
  { id: 4, name: "массив Восточный", parent: 3 },
  { id: 7, name: "ул. Амир Темур", parent: 6 },
];

function getChildren(parentId) {
  return locations.filter(l => l.parent === parentId);
}
function getNode(id) {
  return locations.find(l => l.id === id) || null;
}
function getPathNames(id) {
  const node = getNode(id);
  if (!node) return [];
  return node.parent ? [...getPathNames(node.parent), node.name] : [node.name];
}
function getPathIds(id) {
  const node = getNode(id);
  if (!node) return [];
  return node.parent ? [...getPathIds(node.parent), node.id] : [node.id];
}

// ======= карта (Leaflet + кластеры) =======
const map = L.map("map").setView([41.3111, 69.2797], 12); // Ташкент
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let formMarker = null;

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);

// ======= элементы =======
const $ = (id) => document.getElementById(id);

// фильтры
const searchInput    = $("searchInput");
const categoryFilter = $("categoryFilter");
const statusFilter   = $("statusFilter");
const priceMin       = $("priceMin");
const priceMax       = $("priceMax");
const roomsMin       = $("roomsMin");
const roomsMax       = $("roomsMax");
const areaMin        = $("areaMin");
const areaMax        = $("areaMax");
const floorMin       = $("floorMin");
const floorMax       = $("floorMax");
const districtFilter = $("districtFilter");
const sortSelect     = $("sortSelect");
const onlyFav        = $("onlyFav");
const resetFilters   = $("resetFilters");

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
const yearInput     = $("year");
const houseTypeSel  = $("houseType");

const imagesInput   = $("images");
const imagePreview  = $("imagePreview");
const pickOnMapBtn  = $("pickOnMap");
const coordsBadge   = $("coordsBadge");
const cancelEditBtn = $("cancelEdit");
const clearFormBtn  = $("clearForm");

// древо в форме
const districtSel = $("district");
const quarterSel  = $("quarter");
const streetSel   = $("street");

function populateSelect(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(i => {
    const opt = document.createElement("option");
    opt.value = i.id;
    opt.textContent = i.name;
    select.appendChild(opt);
  });
}
function initLocationSelects() {
  populateSelect(districtSel, getChildren(null), "Выбрать район");
  populateSelect(quarterSel, [], "Выбрать квартал");
  populateSelect(streetSel, [], "Выбрать улицу/массив");
}
districtSel?.addEventListener("change", () => {
  const id = districtSel.value ? +districtSel.value : null;
  populateSelect(quarterSel, id ? getChildren(id) : [], "Выбрать квартал");
  populateSelect(streetSel, [], "Выбрать улицу/массив");
});
quarterSel?.addEventListener("change", () => {
  const id = quarterSel.value ? +quarterSel.value : null;
  populateSelect(streetSel, id ? getChildren(id) : [], "Выбрать улицу/массив");
});

// и корневые районы для фильтра
function initDistrictFilter() {
  // сохраняем текущий выбор
  const prev = districtFilter.value;
  districtFilter.innerHTML = `<option value="">Район: все</option>`;
  getChildren(null).forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    districtFilter.appendChild(opt);
  });
  if (prev) districtFilter.value = prev;
}

// ======= восстановление/сохранение фильтров =======
function loadFilters() {
  const saved = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
  if (saved.q != null) searchInput.value = saved.q;
  if (saved.category) categoryFilter.value = saved.category;
  if (saved.status)   statusFilter.value = saved.status;
  if (saved.priceMin) priceMin.value = saved.priceMin;
  if (saved.priceMax) priceMax.value = saved.priceMax;
  if (saved.roomsMin) roomsMin.value = saved.roomsMin;
  if (saved.roomsMax) roomsMax.value = saved.roomsMax;
  if (saved.areaMin)  areaMin.value = saved.areaMin;
  if (saved.areaMax)  areaMax.value = saved.areaMax;
  if (saved.floorMin) floorMin.value = saved.floorMin;
  if (saved.floorMax) floorMax.value = saved.floorMax;
  if (saved.sort)     sortSelect.value  = saved.sort;
  if (saved.onlyFav)  onlyFav.checked = true;
  if (saved.districtFilter) districtFilter.value = saved.districtFilter;
}
function saveFilters() {
  const f = {
    q: searchInput.value.trim(),
    category: categoryFilter.value,
    status: statusFilter.value,
    priceMin: priceMin.value,
    priceMax: priceMax.value,
    roomsMin: roomsMin.value,
    roomsMax: roomsMax.value,
    areaMin: areaMin.value,
    areaMax: areaMax.value,
    floorMin: floorMin.value,
    floorMax: floorMax.value,
    sort: sortSelect.value,
    onlyFav: onlyFav.checked,
    districtFilter: districtFilter.value
  };
  localStorage.setItem(LS_FILTERS, JSON.stringify(f));
}

// ======= фотки =======
imagesInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      selectedImages.push(ev.target.result);
      renderImagePreview();
    };
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
    wrap.querySelector("button").addEventListener("click", () => {
      selectedImages.splice(idx, 1);
      renderImagePreview();
    });
    imagePreview.appendChild(wrap);
  });
}

// ======= выбор точки на карте =======
pickOnMapBtn.addEventListener("click", () => {
  pickOnMapBtn.disabled = true;
  pickOnMapBtn.textContent = "Кликни по карте…";
  const once = (ev) => {
    tempCoords.lat = +ev.latlng.lat.toFixed(6);
    tempCoords.lng = +ev.latlng.lng.toFixed(6);
    coordsBadge.textContent = `Выбрано: ${tempCoords.lat}, ${tempCoords.lng}`;
    coordsBadge.classList.remove("muted");
    if (formMarker) markerLayer.removeLayer(formMarker);
    formMarker = L.marker([tempCoords.lat, tempCoords.lng]).addTo(markerLayer);
    map.off("click", once);
    pickOnMapBtn.disabled = false;
    pickOnMapBtn.textContent = "Поставить точку на карте";
  };
  map.on("click", once);
});

// ======= сохранение / редактирование =======
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const base = editingId ? objects.find(o => o.id === editingId) : null;

  // Формируем локацию из древа
  const chosenId = streetSel.value || quarterSel.value || districtSel.value || "";
  const locationId = chosenId ? +chosenId : null;
  const locationPath = locationId ? getPathNames(locationId) : [];
  const locationPathIds = locationId ? getPathIds(locationId) : [];

  const obj = {
    id: editingId ?? Date.now(),
    title: titleInput.value.trim(),
    price: +priceInput.value,
    rooms: +roomsInput.value,
    status: statusInput.value,
    category: categoryInput.value,
    address: addressInput.value.trim(),
    area: areaInput.value ? +areaInput.value : null,
    floor: floorInput.value ? +floorInput.value : null,
    year: yearInput.value ? +yearInput.value : null,
    houseType: houseTypeSel.value || null,
    lat: tempCoords.lat,
    lng: tempCoords.lng,
    images: [...selectedImages],
    locationId,
    locationPath,
    locationPathIds,
    createdAt: base ? base.createdAt : Date.now(),
  };

  if (editingId) {
    objects = objects.map(o => o.id === editingId ? obj : o);
  } else {
    objects.push(obj);
  }
  localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
  clearFormState();
  renderAll();
});
cancelEditBtn.addEventListener("click", clearFormState);
clearFormBtn.addEventListener("click", () => {
  form.reset();
  selectedImages=[];
  tempCoords={lat:null,lng:null};
  renderImagePreview();
  initLocationSelects();
});

// ======= clearFormState (фикс) =======
function clearFormState() {
  form.reset();
  editingId = null;
  selectedImages = [];
  tempCoords = { lat: null, lng: null };
  coordsBadge.textContent = "Координаты не выбраны";
  coordsBadge.classList.add("muted");
  renderImagePreview();
  formTitle.textContent = "Добавить объект";
  if (formMarker) {
    markerLayer.removeLayer(formMarker);
    formMarker = null;
  }
  initLocationSelects();
}

// ======= избранное =======
function isFav(id) { return favorites.has(id); }
function toggleFav(id) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  localStorage.setItem(LS_FAVS, JSON.stringify([...favorites]));
  renderAll();
}

// ======= фильтрация =======
function applyFilters(list) {
  let res = [...list];
  const q = searchInput.value.trim().toLowerCase();
  if (q) res = res.filter(o => (o.title||"").toLowerCase().includes(q) || (o.address||"").toLowerCase().includes(q));

  if (categoryFilter.value) res = res.filter(o => o.category === categoryFilter.value);
  if (statusFilter.value)   res = res.filter(o => o.status === statusFilter.value);
  if (priceMin.value) res = res.filter(o => o.price >= +priceMin.value);
  if (priceMax.value) res = res.filter(o => o.price <= +priceMax.value);
  if (roomsMin.value) res = res.filter(o => o.rooms >= +roomsMin.value);
  if (roomsMax.value) res = res.filter(o => o.rooms <= +roomsMax.value);
  if (areaMin.value)  res = res.filter(o => (o.area||0) >= +areaMin.value);
  if (areaMax.value)  res = res.filter(o => (o.area||0) <= +areaMax.value);

  if (floorMin.value) res = res.filter(o => (o.floor ?? 999) >= +floorMin.value);
  if (floorMax.value) res = res.filter(o => (o.floor ?? -999) <= +floorMax.value);

  // фильтр по району (корневой уровень древа)
  if (districtFilter.value) {
    const districtId = +districtFilter.value;
    res = res.filter(o => {
      if (!o.locationPathIds || !o.locationPathIds.length) return false;
      return o.locationPathIds.includes(districtId);
    });
  }

  if (onlyFav.checked) res = res.filter(o => favorites.has(o.id));

  if (sortSelect.value==="priceAsc") res.sort((a,b)=>a.price-b.price);
  if (sortSelect.value==="priceDesc")res.sort((a,b)=>b.price-a.price);
  if (sortSelect.value==="dateNew")  res.sort((a,b)=>b.createdAt-a.createdAt);
  if (sortSelect.value==="dateOld")  res.sort((a,b)=>a.createdAt-b.createdAt);

  return res;
}
[
  searchInput,categoryFilter,statusFilter,priceMin,priceMax,roomsMin,roomsMax,
  areaMin,areaMax,floorMin,floorMax,districtFilter,sortSelect,onlyFav
].forEach(el => el.addEventListener("input", () => { saveFilters(); renderAll(); }));

resetFilters.addEventListener("click", () => {
  [
    searchInput,categoryFilter,statusFilter,priceMin,priceMax,roomsMin,roomsMax,
    areaMin,areaMax,floorMin,floorMax,sortSelect,districtFilter
  ].forEach(el => el.value = "");
  onlyFav.checked = false;
  saveFilters();
  renderAll();
});

// ======= рендер =======
function renderAll() {
  initDistrictFilter();
  const list = applyFilters(objects);
  renderList(list);
  renderMap(list);
}
function renderList(list){
  resultsList.innerHTML="";
  list.forEach(obj=>{
    const card=document.createElement("article");
    card.className="card-item"; card.id=`card-${obj.id}`;
    const img0=obj.images?.[0]||""; const total=obj.images?.length||0;
    card.innerHTML=`
      <div class="slider"><img src="${img0}" style="${img0?'':'display:none'}"/><div class="count">${total?`1/${total}`:"без фото"}</div></div>
      <div class="card-body">
        <div class="card-title">${obj.title}</div>
        <div class="card-meta"><span>Цена: ${obj.price.toLocaleString()}</span><span>Комнат: ${obj.rooms}</span></div>
        <div class="card-meta"><span>Категория: ${obj.category}</span><span>Статус: ${obj.status}</span></div>
        ${obj.address?`<div class="card-meta">Адрес: ${obj.address}</div>`:""}
        ${obj.locationPath?.length ? `<div class="card-meta">Локация: ${obj.locationPath.join(" / ")}</div>` : ""}
        <div class="card-meta">
          ${obj.area?`<span>Площадь: ${obj.area} м²</span>`:""}
          ${obj.floor!=null?`<span>Этаж: ${humanFloor(obj.floor)}</span>`:""}
          ${obj.year?`<span>Год: ${obj.year}</span>`:""}
        </div>
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
    const loc = obj.locationPath?.length ? `<br>${obj.locationPath.join(" / ")}` : "";
    m.bindPopup(`<b>${obj.title}</b><br>${obj.price.toLocaleString()}<br>${humanFloor(obj.floor)}${loc}`);
    cluster.addLayer(m);
  });
}

// ======= редактирование =======
function fillFormForEdit(id){
  const o=objects.find(x=>x.id===id); if(!o) return;
  editingId=o.id;
  titleInput.value=o.title; priceInput.value=o.price; roomsInput.value=o.rooms;
  statusInput.value=o.status; categoryInput.value=o.category; addressInput.value=o.address||"";
  areaInput.value=o.area||""; floorInput.value=o.floor??""; yearInput.value=o.year||""; houseTypeSel.value=o.houseType||"";
  selectedImages=[...(o.images||[])]; renderImagePreview();
  tempCoords={lat:o.lat,lng:o.lng};

  // восстановление селектов древа
  initLocationSelects();
  if (o.locationPathIds?.length) {
    const ids = o.locationPathIds;
    // ids: [districtId, quarterId?, streetId?]
    if (ids[0]) {
      districtSel.value = ids[0];
      districtSel.dispatchEvent(new Event("change"));
    }
    if (ids[1]) {
      quarterSel.value = ids[1];
      quarterSel.dispatchEvent(new Event("change"));
    }
    if (ids[2]) {
      streetSel.value = ids[2];
    }
  }

  formTitle.textContent="Редактировать объект";
}
function deleteObj(id){
  objects=objects.filter(o=>o.id!==id);
  favorites.delete(id);
  localStorage.setItem(LS_OBJECTS,JSON.stringify(objects));
  localStorage.setItem(LS_FAVS,JSON.stringify([...favorites]));
  renderAll();
}

// ======= утилиты =======
function humanFloor(v){if(v===-2)return"Подвал"; if(v===-1)return"Цоколь"; return v;}

// ======= экспорт JSON =======
exportJsonBtn.addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects, null, 2));
  const dl = document.createElement("a");
  dl.setAttribute("href", dataStr);
  dl.setAttribute("download", "objects_" + new Date().toISOString().slice(0,10) + ".json");
  document.body.appendChild(dl);
  dl.click();
  dl.remove();
});

// ======= импорт JSON =======
importJsonBtn.addEventListener("click", () => importJsonInp.click());
importJsonInp.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (Array.isArray(data)) {
        // мягко приводим старые объекты без локации
        objects = data.map(o => ({
          ...o,
          locationId: o.locationId ?? null,
          locationPath: Array.isArray(o.locationPath) ? o.locationPath : (o.locationId ? getPathNames(o.locationId) : []),
          locationPathIds: Array.isArray(o.locationPathIds) ? o.locationPathIds : (o.locationId ? getPathIds(o.locationId) : []),
        }));
        localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
        renderAll();
        alert("Импортировано объектов: " + objects.length);
      } else {
        alert("Файл не содержит массив объектов");
      }
    } catch (err) {
      alert("Ошибка при чтении JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ======= экспорт CSV =======
exportCsvBtn.addEventListener("click", () => {
  if (!objects.length) {
    alert("Нет объектов для экспорта");
    return;
  }
  const headers = ["id","title","price","rooms","status","category","address","area","floor","year","houseType","lat","lng","createdAt","locationId","locationPath"];
  const rows = objects.map(o => {
    const locPath = (o.locationPath||[]).join(" / ");
    const row = [
      o.id, o.title, o.price, o.rooms, o.status, o.category, o.address ?? "",
      o.area ?? "", o.floor ?? "", o.year ?? "", o.houseType ?? "",
      o.lat ?? "", o.lng ?? "", o.createdAt ?? "", o.locationId ?? "", locPath
    ];
    return row.map(v => JSON.stringify(v)).join(",");
  });
  const csv = headers.join(",") + "\n" + rows.join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dl = document.createElement("a");
  dl.setAttribute("href", url);
  dl.setAttribute("download", "objects_" + new Date().toISOString().slice(0,10) + ".csv");
  document.body.appendChild(dl);
  dl.click();
  document.body.removeChild(dl);
});

// ======= init =======
initLocationSelects();
initDistrictFilter();
loadFilters();
renderAll();
