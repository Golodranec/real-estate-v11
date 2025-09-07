// ======= v13.7 =======
console.log("✅ script.js v13.7 loaded");

// хранилище
const LS_OBJECTS = "objects";
const LS_FAVS    = "favorites_v13_7";

// объекты/избранное
let objects   = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));

// всегда свежие данные из админки
const getTreeNodes  = () => JSON.parse(localStorage.getItem("treeNodes")   || "[]");
const getExtraParams= () => JSON.parse(localStorage.getItem("extraParams") || "[]");

// утилиты
const $ = id => document.getElementById(id);
const nameById = id => (getTreeNodes().find(n=>n.id===id)?.name)||"";
const childrenOf = id => getTreeNodes().filter(n=>n.parent===id);
const typed = t => getTreeNodes().filter(n=>n.type===t);
function setOptions(sel, items, placeholder){
  const prev = sel.value;
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(n=>{
    const o=document.createElement("option");
    o.value=String(n.id); o.textContent=n.name;
    sel.appendChild(o);
  });
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value=prev;
}

// карта
const map = L.map("map").setView([41.3111, 69.2797], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
const cluster = L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:45});
map.addLayer(cluster);

// фильтры DOM
const cityFilter=$("cityFilter"), districtFilter=$("districtFilter"), streetFilter=$("streetFilter");
const categoryFilter=$("categoryFilter"), statusFilter=$("statusFilter");
const priceMin=$("priceMin"), priceMax=$("priceMax");
const roomsMin=$("roomsMin"), roomsMax=$("roomsMax");
const floorMin=$("floorMin"), floorMax=$("floorMax");
const floorsMin=$("floorsMin"), floorsMax=$("floorsMax");
const areaMin=$("areaMin"), areaMax=$("areaMax");
const yearMin=$("yearMin"), yearMax=$("yearMax");
const houseTypeFilter=$("houseTypeFilter"), sortSelect=$("sortSelect"), onlyFav=$("onlyFav");
const resetFilters=$("resetFilters"), adminSyncInfo=$("adminSyncInfo"), paramsFiltersBox=$("dynamicParamsFilters");

// форма DOM
const resultsList=$("resultsList");
const categoryInput=$("category"), statusInput=$("status");
const citySel=$("city"), districtSel=$("district"), streetSel=$("street");
const titleInput=$("title"), priceInput=$("price"), roomsInput=$("rooms");
const areaInput=$("area"), floorInput=$("floor"), floorsInput=$("floors"), yearInput=$("year");
const addressInput=$("address"), houseTypeSel=$("houseType");
const dynamicParamsForm=$("dynamicParamsForm");

// построение каскадов фильтров
function initCascadeFilters(){
  setOptions(cityFilter, typed("Город"), "Город");
  setOptions(districtFilter, [], "Район");
  setOptions(streetFilter, [], "Массив / улица");
  setOptions(categoryFilter, typed("Категория"), "Категория");

  cityFilter.onchange=()=>{
    const id=cityFilter.value?+cityFilter.value:null;
    setOptions(districtFilter, id?childrenOf(id).filter(n=>n.type==="Район"):[], "Район");
    setOptions(streetFilter, [], "Массив / улица");
    buildParamsFilters(); renderAll();
  };
  districtFilter.onchange=()=>{
    const id=districtFilter.value?+districtFilter.value:null;
    setOptions(streetFilter, id?childrenOf(id).filter(n=>n.type==="Массив / улица"):[], "Массив / улица");
    renderAll();
  };
  streetFilter.onchange=renderAll;
  categoryFilter.onchange=()=>{ buildParamsFilters(); renderAll(); };
  [statusFilter,houseTypeFilter,priceMin,priceMax,roomsMin,roomsMax,floorMin,floorMax,floorsMin,floorsMax,areaMin,areaMax,yearMin,yearMax,sortSelect,onlyFav]
    .forEach(el=> el && (el.onchange=renderAll));
  resetFilters.onclick=()=>{
    [cityFilter,districtFilter,streetFilter,categoryFilter,statusFilter,houseTypeFilter,sortSelect].forEach(s=>s.value="");
    [priceMin,priceMax,roomsMin,roomsMax,floorMin,floorMax,floorsMin,floorsMax,areaMin,areaMax,yearMin,yearMax].forEach(i=>i.value="");
    onlyFav.checked=false;
    buildParamsFilters(); renderAll();
  };
}

// построение каскадов формы
function initCascadeForm(){
  setOptions(categoryInput, typed("Категория"), "Категория");
  setOptions(citySel, typed("Город"), "Город");
  setOptions(districtSel, [], "Район");
  setOptions(streetSel, [], "Массив / улица");

  citySel.onchange=()=>{
    const id = citySel.value?+citySel.value:null;
    setOptions(districtSel, id?childrenOf(id).filter(n=>n.type==="Район"):[], "Район");
    setOptions(streetSel, [], "Массив / улица");
  };
  districtSel.onchange=()=>{
    const id=districtSel.value?+districtSel.value:null;
    setOptions(streetSel, id?childrenOf(id).filter(n=>n.type==="Массив / улица"):[], "Массив / улица");
  };
  categoryInput.onchange=renderParamsForm;
  renderParamsForm();
}

// динамические параметры
function paramsByCategoryId(id){ return getExtraParams().filter(p=>p.categoryId===id); }
function renderParamsForm(){
  dynamicParamsForm.innerHTML="";
  const catId = categoryInput.value?+categoryInput.value:null;
  if(!catId) return;
  const params = paramsByCategoryId(catId);
  params.forEach(p=>{
    const group=document.createElement("div"); group.className="param-group";
    group.innerHTML=`<div class="param-title">${p.name}</div>`;
    const vals=document.createElement("div"); vals.className="param-values";
    (p.values||[]).forEach(v=>{
      const chip=document.createElement("label"); chip.className="param-chip";
      chip.innerHTML=`<input type="checkbox" data-param="${p.name}" value="${v}"><span>${v}</span>`;
      vals.appendChild(chip);
    });
    group.appendChild(vals); dynamicParamsForm.appendChild(group);
  });
}
function buildParamsFilters(){
  paramsFiltersBox.innerHTML="";
  const catId = categoryFilter.value?+categoryFilter.value:null;
  if(!catId) return;
  const params = paramsByCategoryId(catId);
  params.forEach(p=>{
    const group=document.createElement("div"); group.className="param-group";
    group.innerHTML=`<div class="param-title">${p.name}</div>`;
    const vals=document.createElement("div"); vals.className="param-values";
    (p.values||[]).forEach(v=>{
      const chip=document.createElement("label"); chip.className="param-chip";
      chip.innerHTML=`<input type="checkbox" data-param="${p.name}" value="${v}"><span>${v}</span>`;
      chip.querySelector("input").addEventListener("change", renderAll);
      vals.appendChild(chip);
    });
    group.appendChild(vals); paramsFiltersBox.appendChild(group);
  });
}

// индикатор синхронизации
function updateAdminSyncInfo(){
  const cats = typed("Категория").length;
  const params = getExtraParams().length;
  if (cats||params){
    adminSyncInfo.style.color="#4dff91";
    adminSyncInfo.textContent=`✔ Синхронизировано: ${cats} категорий, ${params} параметров`;
  }else{
    adminSyncInfo.style.color="#ff6b6b";
    adminSyncInfo.textContent="✖ Нет данных из админки";
  }
}

// фильтрация и рендер (заглушка — под свои данные)
function applyFilters(list){ return list; }
function renderAll(){
  // здесь должен быть твой рендер списка/маркеров; оставляю пустым, чтобы не ломать текущую логику
  // пример: const filtered = applyFilters(objects);  затем обновить markers и resultsList
  updateAdminSyncInfo();
}

// запуск
function init(){
  initCascadeFilters();
  initCascadeForm();
  buildParamsFilters();
  updateAdminSyncInfo();
  renderAll();
}
init();
