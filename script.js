// ======= v12 bootstrap =======
console.log("✅ script.js v12 loaded");

const LS_OBJECTS = "objects";           // совместимость с v10/v11
const LS_FILTERS = "filters_v12";
const LS_FAVS    = "favorites_v12";

let objects = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let editingId = null;
let selectedImages = [];        // массив dataURL для превью/сохранения
let tempCoords = { lat: null, lng: null }; // храним скрыто выбранные координаты

// ======= карта (Leaflet) =======
const map = L.map("map").setView([55.751244, 37.618423], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let formMarker = null;

// ======= элементы =======
const $ = (id) => document.getElementById(id);

const searchInput   = $("searchInput");
const categoryFilter= $("categoryFilter");
const statusFilter  = $("statusFilter");
const priceMin      = $("priceMin");
const priceMax      = $("priceMax");
const roomsFilter   = $("roomsFilter");
const sortSelect    = $("sortSelect");
const resetFilters  = $("resetFilters");

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

// ======= восстановление фильтров =======
function loadFilters() {
  const saved = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
  if (saved.q != null) searchInput.value = saved.q;
  if (saved.category) categoryFilter.value = saved.category;
  if (saved.status)   statusFilter.value = saved.status;
  if (typeof saved.priceMin === "number") priceMin.value = saved.priceMin;
  if (typeof saved.priceMax === "number") priceMax.value = saved.priceMax;
  if (saved.rooms)    roomsFilter.value = saved.rooms;
  if (saved.sort)     sortSelect.value  = saved.sort;
}
function saveFilters() {
  const f = {
    q: searchInput.value.trim(),
    category: categoryFilter.value,
    status: statusFilter.value,
    priceMin: priceMin.value ? Number(priceMin.value) : undefined,
    priceMax: priceMax.value ? Number(priceMax.value) : undefined,
    rooms: roomsFilter.value,
    sort: sortSelect.value,
  };
  localStorage.setItem(LS_FILTERS, JSON.stringify(f));
}

// ======= фотки: добавление / превью / удаление =======
imagesInput.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      selectedImages.push(ev.target.result); // добавляем, не затираем
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });
  imagesInput.value = ""; // для повторного выбора тех же файлов
});

function renderImagePreview() {
  imagePreview.innerHTML = "";
  selectedImages.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-item";
    wrap.innerHTML = `
      <img src="${src}" alt="photo"/>
      <button type="button" aria-label="Удалить">✕</button>
    `;
    wrap.querySelector("button").addEventListener("click", () => {
      selectedImages.splice(idx, 1);
      renderImagePreview();
    });
    imagePreview.appendChild(wrap);
  });
}

// ======= выбор точки на карте (без полей lat/lng) =======
pickOnMapBtn.addEventListener("click", () => {
  pickOnMapBtn.disabled = true;
  pickOnMapBtn.textContent = "Кликни по карте…";
  const once = (ev) => {
    const { lat, lng } = ev.latlng;
    tempCoords.lat = Number(lat.toFixed(6));
    tempCoords.lng = Number(lng.toFixed(6));
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

  const obj = {
    id: editingId ?? Date.now(),
    title: titleInput.value.trim(),
    price: Number(priceInput.value),
    rooms: Number(roomsInput.value),
    status: statusInput.value,
    category: categoryInput.value,
    address: addressInput.value.trim(),

    // новые поля
    area: areaInput.value ? Number(areaInput.value) : null,
    floor: floorInput.value ? Number(floorInput.value) : null,
    year: yearInput.value ? Number(yearInput.value) : null,
    houseType: houseTypeSel.value || null,

    // координаты (скрытые для пользователя)
    lat: tempCoords.lat,
    lng: tempCoords.lng,

    images: [...selectedImages],
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
  selectedImages = [];
  tempCoords = { lat: null, lng: null };
  coordsBadge.textContent = "Координаты не выбраны";
  coordsBadge.classList.add("muted");
  renderImagePreview();
});

function clearFormState() {
  form.reset();
  editingId = null;
  selectedImages = [];
  tempCoords = { lat: null, lng: null };
  coordsBadge.textContent = "Координаты не выбраны";
  coordsBadge.classList.add("muted");
  renderImagePreview();
  formTitle.textContent = "Добавить объект";
  if (formMarker) { markerLayer.removeLayer(formMarker); formMarker = null; }
}

// ======= избранное =======
function isFav(id) { return favorites.has(id); }
function toggleFav(id) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  localStorage.setItem(LS_FAVS, JSON.stringify(Array.from(favorites)));
  renderAll(); // для обновления состояния иконок
}

// ======= фильтрация + поиск + сортировка =======
function applyFilters(list) {
  let res = [...list];
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    res = res.filter(o =>
      (o.title && o.title.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q))
    );
  }

  const cat = categoryFilter.value;
  const st  = statusFilter.value;
  const rm  = roomsFilter.value;
  const pmin = priceMin.value ? Number(priceMin.value) : null;
  const pmax = priceMax.value ? Number(priceMax.value) : null;

  if (cat) res = res.filter(o => o.category === cat);
  if (st)  res = res.filter(o => o.status === st);
  if (rm)  res = res.filter(o => rm === "4" ? o.rooms >= 4 : o.rooms === Number(rm));
  if (pmin !== null) res = res.filter(o => o.price >= pmin);
  if (pmax !== null) res = res.filter(o => o.price <= pmax);

  const sort = sortSelect.value;
  if (sort === "priceAsc") res.sort((a,b) => a.price - b.price);
  if (sort === "priceDesc") res.sort((a,b) => b.price - a.price);
  if (sort === "dateNew") res.sort((a,b) => b.createdAt - a.createdAt);
  if (sort === "dateOld") res.sort((a,b) => a.createdAt - b.createdAt);

  return res;
}

[searchInput, categoryFilter, statusFilter, roomsFilter, priceMin, priceMax, sortSelect]
  .forEach(elm => elm.addEventListener("input", () => { saveFilters(); renderAll(); }));
resetFilters.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  statusFilter.value = "";
  roomsFilter.value = "";
  priceMin.value = "";
  priceMax.value = "";
  sortSelect.value = "";
  saveFilters();
  renderAll();
});

// ======= рендер списка + карта =======
function renderAll() {
  const list = applyFilters(objects);
  renderList(list);
  renderMap(list);
}

function renderList(list) {
  resultsList.innerHTML = "";
  list.forEach(obj => {
    const card = document.createElement("article");
    card.className = "card-item";
    card.id = `card-${obj.id}`;

    const img0 = obj.images && obj.images.length ? obj.images[0] : "";
    const total = obj.images ? obj.images.length : 0;

    card.innerHTML = `
      <div class="slider" data-id="${obj.id}">
        <button class="nav prev" type="button" aria-label="Предыдущее">‹</button>
        <img src="${img0 || ""}" alt="${obj.title}" ${img0 ? "" : 'style="display:none"'} />
        <div class="count">${total ? `1 / ${total}` : "без фото"}</div>
        <button class="nav next" type="button" aria-label="Следующее">›</button>
      </div>
      <div class="card-body">
        <div class="card-title">${obj.title}</div>
        <div class="card-meta">
          <span>Цена: ${Number(obj.price || 0).toLocaleString()}</span>
          <span>Комнат: ${obj.rooms || "-"}</span>
        </div>
        <div class="card-meta">
          <span>Категория: ${humanCategory(obj.category)}</span>
          <span>Статус: ${humanStatus(obj.status)}</span>
        </div>
        ${obj.address ? `<div class="card-meta">Адрес: ${obj.address}</div>` : ""}
        <div class="card-meta">
          ${obj.area ? `<span>Площадь: ${obj.area} м²</span>` : ""}
          ${obj.floor != null && obj.floor !== "" ? `<span>Этаж: ${obj.floor}</span>` : ""}
          ${obj.year ? `<span>Год: ${obj.year}</span>` : ""}
          ${obj.houseType ? `<span>Тип: ${humanHouseType(obj.houseType)}</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn" data-edit="${obj.id}">Редактировать</button>
          <button class="btn danger" data-del="${obj.id}">Удалить</button>
          <button class="fav-btn ${isFav(obj.id) ? "active" : ""}" title="В избранное" data-fav="${obj.id}">♥</button>
        </div>
      </div>
    `;

    attachSlider(card, obj);

    card.querySelector('[data-edit]').addEventListener('click', () => fillFormForEdit(obj.id));
    card.querySelector('[data-del]').addEventListener('click', () => {
      objects = objects.filter(o => o.id !== obj.id);
      favorites.delete(obj.id);
      localStorage.setItem(LS_FAVS, JSON.stringify(Array.from(favorites)));
      localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
      renderAll();
    });
    card.querySelector('[data-fav]').addEventListener('click', () => toggleFav(obj.id));

    resultsList.appendChild(card);
  });
}

function attachSlider(card, obj) {
  const slider = card.querySelector(".slider");
  const img = slider.querySelector("img");
  const prev = slider.querySelector(".prev");
  const next = slider.querySelector(".next");
  const count = slider.querySelector(".count");

  if (!obj.images || obj.images.length === 0) {
    prev.style.display = "none";
    next.style.display = "none";
    return;
  }

  let i = 0;
  const total = obj.images.length;

  function update() {
    img.src = obj.images[i];
    img.style.display = "block";
    count.textContent = `${i+1} / ${total}`;
  }
  prev.addEventListener("click", () => { i = (i - 1 + total) % total; update(); });
  next.addEventListener("click", () => { i = (i + 1) % total; update(); });
}

function renderMap(list) {
  markerLayer.clearLayers();
  list.forEach(obj => {
    if (obj.lat == null || obj.lng == null) return;
    const m = L.marker([obj.lat, obj.lng]);
    const img = obj.images && obj.images[0] ? `<img src="${obj.images[0]}" style="width:140px;height:100px;object-fit:cover;border-radius:8px" />` : "";
    const html = `
      <div style="text-align:center">
        ${img ? `<a href="#card-${obj.id}" data-scroll="${obj.id}">${img}</a>` : ""}
        <div style="margin-top:6px;font-weight:600">${obj.title}</div>
        <div style="color:#666">${Number(obj.price||0).toLocaleString()} • ${obj.rooms || "-"} комн.</div>
      </div>`;
    m.bindPopup(html);
    m.addTo(markerLayer);
    m.on("popupopen", (e) => {
      const a = e.popup.getElement().querySelector(`[data-scroll="${obj.id}"]`);
      if (a) {
        a.addEventListener("click", () => {
          const card = document.getElementById(`card-${obj.id}`);
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("pulse");
            setTimeout(() => card.classList.remove("pulse"), 900);
          }
        });
      }
    });
  });
}

// ======= редактирование =======
function fillFormForEdit(id) {
  const obj = objects.find(o => o.id === id);
  if (!obj) return;
  editingId = obj.id;

  titleInput.value = obj.title || "";
  priceInput.value = obj.price ?? "";
  roomsInput.value = obj.rooms ?? "";
  statusInput.value = obj.status || "sale";
  categoryInput.value = obj.category || "apartment";
  addressInput.value = obj.address || "";

  areaInput.value = obj.area ?? "";
  floorInput.value = obj.floor ?? "";
  yearInput.value = obj.year ?? "";
  houseTypeSel.value = obj.houseType || "";

  tempCoords = { lat: obj.lat ?? null, lng: obj.lng ?? null };
  if (tempCoords.lat != null && tempCoords.lng != null) {
    coordsBadge.textContent = `Выбрано: ${tempCoords.lat}, ${tempCoords.lng}`;
    coordsBadge.classList.remove("muted");
    if (formMarker) markerLayer.removeLayer(formMarker);
    formMarker = L.marker([tempCoords.lat, tempCoords.lng]).addTo(markerLayer);
    map.setView([tempCoords.lat, tempCoords.lng], 13);
  } else {
    coordsBadge.textContent = "Координаты не выбраны";
    coordsBadge.classList.add("muted");
  }

  selectedImages = Array.isArray(obj.images) ? [...obj.images] : [];
  renderImagePreview();

  formTitle.textContent = "Редактирование объекта";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ======= утилиты =======
function humanCategory(v) {
  return { apartment: "Квартира", house: "Дом", land: "Участок", commercial: "Коммерция" }[v] || v;
}
function humanStatus(v) {
  return { sale: "Продается", rent: "Сдается", sold: "Продано/Сдано" }[v] || v;
}
function humanHouseType(v) {
  return { brick: "Кирпичный", panel: "Панельный", block: "Блочный", monolithic: "Монолит", wood: "Деревянный" }[v] || v;
}

// ======= старт =======
loadFilters();
renderAll();

// демо-объект если пусто (для наглядности)
if (!objects.length) {
  const demo = {
    id: Date.now(),
    title: "Демо-квартира у парка",
    price: 9200000,
    rooms: 2,
    status: "sale",
    category: "apartment",
    address: "ул. Примерная, 1",
    lat: 55.76, lng: 37.62,
    images: [],
    area: 54.2, floor: 7, year: 2016, houseType: "monolithic",
    createdAt: Date.now(),
  };
  objects.push(demo);
  localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
  renderAll();
}

// слушатели для мгновенной фильтрации/поиска/сортировки
[searchInput, categoryFilter, statusFilter, roomsFilter, priceMin, priceMax, sortSelect]
  .forEach(elm => elm.addEventListener("change", () => { saveFilters(); renderAll(); }));

// небольшая защита от мобильного автозума
document.addEventListener("touchstart", () => {}, {passive:true});
