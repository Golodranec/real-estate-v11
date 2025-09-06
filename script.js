console.log("✅ script.js v13.3.1 loaded");

// демо-объекты (чтоб было что фильтровать)
let objects = [
  {
    id: 1,
    title: "Квартира на Навои",
    category: "Квартиры",
    city: "Ташкент",
    district: "Мирабад",
    street: "ул. Навои",
    price: 50000,
    rooms: 3,
    floor: 4,        // этаж
    floors: 9,       // этажность дома
    area: 67
  },
  {
    id: 2,
    title: "Дом в Юнусабаде",
    category: "Дома",
    city: "Ташкент",
    district: "Юнусабад",
    street: "массив Восточный",
    price: 150000,
    rooms: 5,
    floor: null,
    floors: 2,
    area: 220
  }
];

// читаем дерево из админки
let treeNodes = JSON.parse(localStorage.getItem("treeNodes") || "[]");

// быстрые хелперы
const $ = id => document.getElementById(id);
const byId = id => treeNodes.find(n => n.id === id) || null;
const nameById = id => (byId(id)?.name) || "";

// выборки по типам/родителям
function childrenOf(parentId) {
  return treeNodes.filter(n => n.parent === parentId);
}
function typed(type, parentId = null) {
  return treeNodes.filter(n => n.type === type && (parentId === null ? true : n.parent === parentId));
}

// заполнение select
function setOptions(select, items, placeholder) {
  const prev = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(n => {
    const opt = document.createElement("option");
    opt.value = String(n.id);
    opt.textContent = n.name;
    select.appendChild(opt);
  });
  // вернуть выбор, если всё ещё существует
  if (prev && [...select.options].some(o => o.value === prev)) select.value = prev;
}

// инициализация каскада город → район → улица
function initCascade() {
  setOptions($("cityFilter"), typed("Город"), "Город");
  // сброс зависимых
  setOptions($("districtFilter"), [], "Район");
  setOptions($("streetFilter"), [], "Улица / массив");

  $("cityFilter").addEventListener("change", () => {
    const cityId = +($("cityFilter").value || 0);
    setOptions($("districtFilter"), childrenOf(cityId).filter(n => n.type === "Район"), "Район");
    setOptions($("streetFilter"), [], "Улица / массив");
    renderList();
  });

  $("districtFilter").addEventListener("change", () => {
    const districtId = +($("districtFilter").value || 0);
    setOptions($("streetFilter"), childrenOf(districtId).filter(n => n.type === "Улица"), "Улица / массив");
    renderList();
  });

  $("streetFilter").addEventListener("change", renderList);
}

// инициализация категорий (берём корневые "Категория")
function initCategories() {
  setOptions($("categoryFilter"), typed("Категория"), "Категория");
  $("categoryFilter").addEventListener("change", renderList);
}

// фильтры числовые и сброс
[
  "priceMin","priceMax","roomsMin","roomsMax","floorMin","floorMax",
  "floorsMin","floorsMax","areaMin","areaMax"
].forEach(id => $(id).addEventListener("input", renderList));

$("resetFilters").addEventListener("click", () => {
  ["cityFilter","districtFilter","streetFilter","categoryFilter",
   "priceMin","priceMax","roomsMin","roomsMax","floorMin","floorMax",
   "floorsMin","floorsMax","areaMin","areaMax"].forEach(id => {
     const el = $(id);
     if (el.tagName === "SELECT") el.value = "";
     else el.value = "";
   });
  initCascade(); // пересобрать зависимые списки
  renderList();
});

// рисуем список
function renderList() {
  const info = $("filtersInfo");
  if (!treeNodes.length) {
    info.style.display = "block";
    info.textContent = "Нет данных из админки. Открой admin.html, добавь Город → Район → Улица и Категорию.";
  } else {
    info.style.display = "none";
  }

  const cityId = +($("cityFilter").value || 0);
  const districtId = +($("districtFilter").value || 0);
  const streetId = +($("streetFilter").value || 0);
  const cityName = cityId ? nameById(cityId) : "";
  const districtName = districtId ? nameById(districtId) : "";
  const streetName = streetId ? nameById(streetId) : "";
  const categoryId = +($("categoryFilter").value || 0);
  const categoryName = categoryId ? nameById(categoryId) : "";

  let list = [...objects];

  if (cityName)     list = list.filter(o => (o.city||"")     === cityName);
  if (districtName) list = list.filter(o => (o.district||"") === districtName);
  if (streetName)   list = list.filter(o => (o.street||"")   === streetName);
  if (categoryName) list = list.filter(o => (o.category||"") === categoryName);

  const num = v => (v==="" || v===null || v===undefined ? null : +v);

  const pMin = num($("priceMin").value),  pMax = num($("priceMax").value);
  const rMin = num($("roomsMin").value),  rMax = num($("roomsMax").value);
  const fMin = num($("floorMin").value),  fMax = num($("floorMax").value);
  const fsMin= num($("floorsMin").value), fsMax= num($("floorsMax").value);
  const aMin = num($("areaMin").value),   aMax = num($("areaMax").value);

  if (pMin!==null) list = list.filter(o => (o.price ?? Infinity) >= pMin);
  if (pMax!==null) list = list.filter(o => (o.price ?? -Infinity) <= pMax);

  if (rMin!==null) list = list.filter(o => (o.rooms ?? Infinity) >= rMin);
  if (rMax!==null) list = list.filter(o => (o.rooms ?? -Infinity) <= rMax);

  if (fMin!==null) list = list.filter(o => (o.floor ?? Infinity) >= fMin);
  if (fMax!==null) list = list.filter(o => (o.floor ?? -Infinity) <= fMax);

  if (fsMin!==null) list = list.filter(o => (o.floors ?? Infinity) >= fsMin);
  if (fsMax!==null) list = list.filter(o => (o.floors ?? -Infinity) <= fsMax);

  if (aMin!==null) list = list.filter(o => (o.area ?? Infinity) >= aMin);
  if (aMax!==null) list = list.filter(o => (o.area ?? -Infinity) <= aMax);

  const root = $("resultsList");
  root.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "result-card";
    empty.textContent = "Ничего не найдено по текущим условиям.";
    root.appendChild(empty);
    return;
  }
  list.forEach(o => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-title">${o.title}</div>
      <div class="result-meta">
        ${o.category || "—"} · ${o.price?.toLocaleString() || "—"} $
        · ${o.rooms!=null ? (o.rooms + " комн.") : "—"}
        · ${o.city || "—"}${o.district ? ", " + o.district : ""}${o.street ? ", " + o.street : ""}
        ${o.floor!=null ? " · этаж " + o.floor : ""}${o.floors!=null ? " / " + o.floors : ""}
        ${o.area!=null ? " · " + o.area + " м²" : ""}
      </div>
    `;
    root.appendChild(card);
  });
}

// старт
function init() {
  // подсказка, если пусто
  if (!treeNodes.length) {
    $("filtersInfo").style.display = "block";
    $("filtersInfo").textContent = "Пока нет данных из админки. Открой admin.html, добавь Город → Район → Улица и Категорию, затем обнови эту страницу.";
  }

  initCascade();
  initCategories();
  renderList();
}

init();
