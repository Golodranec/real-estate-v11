// ======= v11 bootstrap =======
console.log("✅ script.js v11 loaded");

const LS_KEY = "objects";           // оставляем совместимость с v10
const LS_FILTERS = "filters_v11";

let objects = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
let editingId = null;
let selectedImages = [];            // превью для формы
let pickMode = false;               // выбор точки на карте

// ======= карта (Leaflet) =======
const map = L.map("map").setView([55.751244, 37.618423], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
let formMarker = null;

// ======= элементы =======
const el = (id) => document.getElementById(id);
const listEl = el("resultsList");

// фильтры
const categoryFilter = el("categoryFilter");
const statusFilter = el("statusFilter");
const priceMin = el("priceMin");
const priceMax = el("priceMax");
const roomsFilter = el("roomsFilter");
const sortSelect = el("sortSelect");
const resetFilters = el("resetFilters");

// форма
const form = el("addForm");
const formTitle = el("formTitle");
const titleInput = el("title");
const priceInput = el("price");
const roomsInput = el("rooms");
const statusInput = el("status");
const categoryInput = el("category");
const addressInput = el("address");
const latInput = el("lat");
const lngInput = el("lng");
const imagesInput = el("images");
const imagePreview = el("imagePreview");
const pickOnMapBtn = el("pickOnMap");
const cancelEditBtn = el("cancelEdit");
const clearFormBtn = el("clearForm");

// ======= восстановление фильтров =======
function loadFilters() {
  const saved = JSON.parse(localStorage.getItem(LS_FILTERS) || "{}");
  if (saved.category) categoryFilter.value = saved.category;
  if (saved.status) statusFilter.value = saved.status;
  if (typeof saved.priceMin === "number") priceMin.value = saved.priceMin;
  if (typeof saved.priceMax === "number") priceMax.value = saved.priceMax;
  if (saved.rooms) roomsFilter.value = saved.rooms;
  if (saved.sort)  sortSelect.value = saved.sort;
}
function saveFilters() {
  const f = {
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
      selectedImages.push(ev.target.result);   // добавляем, не затираем
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });
  imagesInput.value = ""; // чтоб можно было повторно выбирать ту же фотку
});

function renderImagePreview() {
  imagePreview.innerHTML = "";
  selectedImages.forEach((src, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-item";
    wrap.innerHTML = `
      <img src="${src}" alt="photo"/>
      <button type="button" aria-label="Удалить" data-idx="${idx}">✕</button>
    `;
    wrap.querySelector("button").addEventListener("click", () => {
      selectedImages.splice(idx, 1);
      renderImagePreview();
    });
    imagePreview.appendChild(wrap);
  });
}

// ======= выбор точки на карте =======
pickOnMapBtn.addEventListener("click", () => {
  pickMode = true;
  pickOnMapBtn.disabled = true;
  pickOnMapBtn.textContent = "Кликни по карте…";
  const once = (ev) => {
    const { lat, lng } = ev.latlng;
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    if (formMarker) markerLayer.removeLayer(formMarker);
    formMarker = L.marker([lat, lng]).addTo(markerLayer);
    pickMode = false;
    pickOnMapBtn.disabled = false;
    pickOnMapBtn.textContent = "Поставить точку на карте";
    map.off("click", once);
  };
  map.on("click", once);
});

// ======= сохранение / редактирование =======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const objBase = editingId ? objects.find(o => o.id === editingId) : null;

  const obj = {
    id: editingId ?? Date.now(),
    title: titleInput.value.trim(),
    price: Number(priceInput.value),
    rooms: Number(roomsInput.value),
    status: statusInput.value,
    category: categoryInput.value,
    address: addressInput.value.trim(),
    lat: latInput.value ? Number(latInput.value) : null,
    lng: lngInput.value ? Number(lngInput.value) : null,
    images: [...selectedImages],                                // сохраняем текущий набор
    createdAt: objBase ? objBase.createdAt : Date.now(),
  };

  if (editingId) {
    objects = objects.map(o => o.id === editingId ? obj : o);
  } else {
    objects.push(obj);
  }

  localStorage.setItem(LS_KEY, JSON.stringify(objects));
  clearFormState();
  renderAll();
});

cancelEditBtn.addEventListener("click", () => {
  clearFormState();
});

clearFormBtn.addEventListener("click", () => {
  form.reset();
  selectedImages = [];
  renderImagePreview();
});

function clearFormState() {
  form.reset();
  editingId = null;
  selectedImages = [];
  renderImagePreview();
  formTitle.textContent = "Добавить объект";
  if (formMarker) { markerLayer.removeLayer(formMarker); formMarker = null; }
}

// ======= фильтрация + сортировка =======
function applyFilters(list) {
  let res = [...list];
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

[categoryFilter, statusFilter, roomsFilter, priceMin, priceMax, sortSelect]
  .forEach(elm => elm.addEventListener("change", () => { saveFilters(); renderAll(); }));

resetFilters.addEventListener("click", () => {
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
  listEl.innerHTML = "";
  list.forEach(obj => {
    const card = document.createElement("article");
    card.className = "card-item";
    card.id = `card-${obj.id}`;

    const img0 = obj.images && obj.images.length ? obj.images[0] : "";
    const count = obj.images ? obj.images.length : 0;

    card.innerHTML = `
      <div class="slider" data-id="${obj.id}">
        <button class="nav prev" type="button" aria-label="Предыдущее">‹</button>
        <img src="${img0 || ""}" alt="${obj.title}" ${img0 ? "" : 'style="display:none"'} />
        <div class="count">${count ? `1 / ${count}` : "без фото"}</div>
        <button class="nav next" type="button" aria-label="Следующее">›</button>
      </div>
      <div class="card-body">
        <div class="card-title">${obj.title}</div>
        <div class="card-meta">Цена: ${obj.price.toLocaleString()} • Комнат: ${obj.rooms}</div>
        <div class="card-meta">Категория: ${humanCategory(obj.category)} • Статус: ${humanStatus(obj.status)}</div>
        ${obj.address ? `<div class="card-meta">Адрес: ${obj.address}</div>` : ""}
        <div class="card-actions">
          <button class="btn" data-edit="${obj.id}">Редактировать</button>
          <button class="btn danger" data-del="${obj.id}">Удалить</button>
        </div>
      </div>
    `;

    // слайдер внутри карточки
    attachSlider(card, obj);

    // кнопки редакт/удалить
    card.querySelector('[data-edit]').addEventListener('click', () => fillFormForEdit(obj.id));
    card.querySelector('[data-del]').addEventListener('click', () => {
      objects = objects.filter(o => o.id !== obj.id);
      localStorage.setItem(LS_KEY, JSON.stringify(objects));
      renderAll();
    });

    listEl.appendChild(card);
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
        <div style="color:#666">${obj.price.toLocaleString()} • ${obj.rooms} комн.</div>
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

// ======= заполняем форму для редактирования =======
function fillFormForEdit(id) {
  const obj = objects.find(o => o.id === id);
  if (!obj) return;
  editingId = obj.id;

  titleInput.value = obj.title;
  priceInput.value = obj.price;
  roomsInput.value = obj.rooms;
  statusInput.value = obj.status;
  categoryInput.value = obj.category;
  addressInput.value = obj.address || "";
  latInput.value = obj.lat ?? "";
  lngInput.value = obj.lng ?? "";

  selectedImages = Array.isArray(obj.images) ? [...obj.images] : [];
  renderImagePreview();

  if (formMarker) { markerLayer.removeLayer(formMarker); formMarker = null; }
  if (obj.lat != null && obj.lng != null) {
    formMarker = L.marker([obj.lat, obj.lng]).addTo(markerLayer);
    map.setView([obj.lat, obj.lng], 13);
  }

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

// ======= старт =======
loadFilters();
renderAll();

// Если объектов нет — можно кинуть пример для наглядности (один раз)
if (!objects.length) {
  const demo = {
    id: Date.now(),
    title: "Демо-квартира у парка",
    price: 8500000,
    rooms: 2,
    status: "sale",
    category: "apartment",
    address: "ул. Примерная, 1",
    lat: 55.76, lng: 37.62,
    images: [],
    createdAt: Date.now(),
  };
  objects.push(demo);
  localStorage.setItem(LS_KEY, JSON.stringify(objects));
  renderAll();
}

// лёгкая подсветка карточки при скролле из попапа
const style = document.createElement("style");
style.textContent = `.pulse{box-shadow:0 0 0 3px rgba(77,163,255,.5) inset}`;
document.head.appendChild(style);
