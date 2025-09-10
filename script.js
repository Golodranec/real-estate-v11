
// ======= v13.9.5 (stable) =======
// Полный script.js на основе v13.9.4 + добавлено редактирование объявлений

console.log("✅ script.js v13.9.5 loaded");

// Ключи для localStorage
const LS_OBJECTS = "objects";
const LS_FAVS    = "favorites_v13_9_5";

// Глобальное состояние
let objects   = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let selectedImages = [];
let tempCoords = null;
let pickMode = false;
let tempMarker = null;
let editId = null; // режим редактирования

// Утилиты
const $ = id => document.getElementById(id);
const fmtNum = (n) => (isFinite(n) && n>0) ? Number(n).toLocaleString() : "";

function resetForm(){
  ["title","address","price","area","rooms","floor","floors","year"].forEach(id=>{ const el=$(id); if(el) el.value=""; });
  editId = null;
  selectedImages = [];
  $("imagePreview").innerHTML = "";
  tempCoords = null;
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
  const badge = $("coordsBadge"); if (badge) { badge.textContent = "Координаты не выбраны"; }
}

// Сохранение/редактирование объекта
function attachFormSubmit() {
  const form = $("objectForm");
  $("clearForm").onclick = () => { resetForm(); };

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const obj = {
      id: editId || Date.now(),
      title: $("title").value.trim(),
      address: $("address").value.trim(),
      price: +($("price").value || 0),
      area: +($("area").value || 0),
      rooms: +($("rooms").value || 0),
      floor: +($("floor").value || 0),
      floors: +($("floors").value || 0),
      year: +($("year").value || 0),
      images: selectedImages.slice(0),
      coords: tempCoords ? { ...tempCoords } : null,
      createdAt: editId ? objects.find(o => o.id === editId).createdAt : Date.now()
    };

    if (editId) {
      const idx = objects.findIndex(o => o.id === editId);
      if (idx !== -1) objects[idx] = obj;
    } else {
      objects.push(obj);
    }

    localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
    resetForm();
    renderAll();
  };
}

// Кнопка редактировать
function editObject(id){
  const obj = objects.find(o => o.id === id);
  if (!obj) return;
  editId = obj.id;
  $("title").value = obj.title || "";
  $("address").value = obj.address || "";
  $("price").value = obj.price || "";
  $("area").value = obj.area || "";
  $("rooms").value = obj.rooms || "";
  $("floor").value = obj.floor || "";
  $("floors").value = obj.floors || "";
  $("year").value = obj.year || "";
  selectedImages = obj.images || [];
  $("imagePreview").innerHTML = selectedImages.map(im=>`<img src="${im.dataUrl}">`).join("");
  tempCoords = obj.coords || null;
  const badge = $("coordsBadge");
  if (badge) badge.textContent = tempCoords ? `Выбрано: ${tempCoords.lat.toFixed(5)}, ${tempCoords.lng.toFixed(5)}` : "Координаты не выбраны";
}

// Рендер списка
function renderResults(list = objects) {
  const wrap = $("resultsList");
  wrap.innerHTML = "";
  if (!list.length) { wrap.innerHTML = `<div class="muted">Нет объектов</div>`; return; }
  list.forEach(o => {
    const card = document.createElement("div");
    card.className = "item";
    card.innerHTML = `
      <h3>${o.title||"(без названия)"} <button onclick="editObject(${o.id})">✏️</button></h3>
      <div class="price">${fmtNum(o.price)} сум</div>
      <div class="meta">${o.address||""}</div>
    `;
    wrap.appendChild(card);
  });
}

// Заглушка для карты (чтобы не падало)
const map = { removeLayer:()=>{} };

function renderAll(){
  renderResults(objects);
}

// Инициализация
window.addEventListener("DOMContentLoaded", ()=>{
  attachFormSubmit();
  renderAll();
});
