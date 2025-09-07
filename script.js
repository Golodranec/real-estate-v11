// ======= v13.9.3 =======
console.log("✅ script.js v13.9.3 loaded");

const LS_OBJECTS = "objects";
const LS_FAVS    = "favorites_v13_9_3";

let objects   = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem(LS_FAVS) || "[]"));
let selectedImages = [];
let tempCoords = null;
let pickMode = false;
let tempMarker = null;

const getTreeNodes   = () => JSON.parse(localStorage.getItem("treeNodes")   || "[]");
const getNodeTypes   = () => JSON.parse(localStorage.getItem("nodeTypes")   || "[]");
const getExtraParams = () => JSON.parse(localStorage.getItem("extraParams") || "[]");

const $ = id => document.getElementById(id);
const fmtNum = n => (isFinite(n) && +n>0) ? Number(n).toLocaleString() : "";
const nameById = id => (getTreeNodes().find(n=>n.id===id)?.name)||"";

const detectCategoryType = () => {
  const types = getNodeTypes();
  const exact = types.find(t => t.trim().toLowerCase() === "категория");
  if (exact) return exact;
  const byWord = types.find(t => /кат|тип|category/i.test(t));
  return byWord || types[0] || null;
};

// ---------- MAP (с защитой) ----------
let map = null, cluster = null;
function safeInitMap(){
  try{
    if (!window.L) throw new Error("Leaflet не загружен");
    map = L.map("map").setView([41.3111, 69.2797], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {maxZoom:19, attribution:"© OpenStreetMap"}).addTo(map);
    if (!L.markerClusterGroup) throw new Error("MarkerCluster не загружен");
    cluster = L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:45 });
    map.addLayer(cluster);
    statusOK("Карта инициализирована");
  }catch(e){
    statusERR("Карта не инициализирована: "+e.message);
    console.error(e);
  }
}

// ---------- UI helpers ----------
function statusOK(text){
  const box = $("filtersBox"); if (!box) return;
  let ok = document.getElementById("scriptStatus");
  if (!ok){ ok = document.createElement("div"); ok.id="scriptStatus"; box.appendChild(ok); }
  ok.className = "hint"; ok.style.color = "#4dff91"; ok.textContent = "✔ "+text;
}
function statusERR(text){
  const box = $("filtersBox"); if (!box) return;
  let er = document.getElementById("scriptError");
  if (!er){ er = document.createElement("div"); er.id="scriptError"; box.appendChild(er); }
  er.className = "hint"; er.style.color = "#ff6b6b"; er.textContent = "✖ "+text;
}

// ---------- FILTERS ----------
function buildFilters(){
  const box = $("filtersBox"); if (!box) return;
  box.innerHTML = "";

  const types = getNodeTypes();
  const nodes = getTreeNodes();

  types.forEach(typeName=>{
    const sel = document.createElement("select");
    sel.id = `filter_${typeName}`;
    sel.innerHTML = `<option value="">${typeName}</option>`;
    nodes.filter(n=>n.type===typeName).forEach(n=>{
      const o = document.createElement("option");
      o.value = n.id; o.textContent = n.name;
      sel.appendChild(o);
    });
    sel.onchange = ()=>{ buildParamsFilters(); renderAll(true); };
    box.appendChild(sel);
  });

  const status = document.createElement("select");
  status.id = "filter_status";
  status.innerHTML = `
    <option value="">Статус</option>
    <option value="sale">Продается</option>
    <option value="rent">Сдается</option>
    <option value="exchange">Обмен</option>`;
  status.onchange = ()=>renderAll(true);
  box.appendChild(status);

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Сбросить";
  resetBtn.className = "btn ghost";
  resetBtn.onclick = ()=>{ buildFilters(); renderAll(true); };
  box.appendChild(resetBtn);

  const sync = document.createElement("div");
  sync.id = "adminSyncInfo"; sync.className = "hint"; sync.style.gridColumn = "1/-1";
  box.appendChild(sync);

  const dyn = document.createElement("div");
  dyn.id = "dynamicParamsFilters"; dyn.className = "params-box"; dyn.style.gridColumn = "1/-1";
  box.appendChild(dyn);

  updateAdminSyncInfo();
  buildParamsFilters();
}

// ---------- FORM ----------
function buildForm(){
  const box = $("dynamicLocationForm"); if (!box) return;
  box.innerHTML = "";
  const types = getNodeTypes();
  const nodes = getTreeNodes();
  types.forEach(typeName=>{
    const sel = document.createElement("select");
    sel.id = `form_${typeName}`;
    sel.innerHTML = `<option value="">${typeName}</option>`;
    nodes.filter(n=>n.type===typeName).forEach(n=>{
      const o=document.createElement("option");
      o.value=n.id; o.textContent=n.name; sel.appendChild(o);
    });
    sel.onchange = ()=>{ if (typeName===detectCategoryType()) renderParamsForm(); };
    box.appendChild(sel);
  });
}

// ---------- PARAMS ----------
function paramsForCategoryNode(catNodeId){
  return getExtraParams().filter(p=>p.categoryId===catNodeId);
}
function currentCategoryNodeIdFromFilters(){
  const t = detectCategoryType(); if (!t) return null;
  const el = $(`filter_${t}`); if (!el || !el.value) return null;
  return +el.value;
}
function currentCategoryNodeIdFromForm(){
  const t = detectCategoryType(); if (!t) return null;
  const el = $(`form_${t}`); if (!el || !el.value) return null;
  return +el.value;
}
function buildParamsFilters(){
  const box = $("dynamicParamsFilters"); if (!box) return;
  box.innerHTML = "";
  const catId = currentCategoryNodeIdFromFilters(); if (!catId) return;
  paramsForCategoryNode(catId).forEach(p=>{
    const group = document.createElement("div"); group.className="param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div"); vals.className="param-values";
    (p.values||[]).forEach(val=>{
      const chip = document.createElement("label"); chip.className="param-chip";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}"><span>${val}</span>`;
      chip.querySelector("input").addEventListener("change", ()=>renderAll(true));
      vals.appendChild(chip);
    });
    group.appendChild(vals); box.appendChild(group);
  });
}
function renderParamsForm(){
  const box = $("dynamicParamsForm"); if (!box) return;
  box.innerHTML = "";
  const catId = currentCategoryNodeIdFromForm(); if (!catId) return;
  paramsForCategoryNode(catId).forEach(p=>{
    const group = document.createElement("div"); group.className="param-group";
    group.innerHTML = `<div class="param-title">${p.name}</div>`;
    const vals = document.createElement("div"); vals.className="param-values";
    (p.values||[]).forEach(val=>{
      const chip = document.createElement("label"); chip.className="param-chip";
      chip.innerHTML = `<input type="checkbox" data-param="${p.name}" value="${val}"><span>${val}</span>`;
      vals.appendChild(chip);
    });
    group.appendChild(vals); box.appendChild(group);
  });
}
function updateAdminSyncInfo(){
  const el = $("adminSyncInfo"); if (!el) return;
  const t = getNodeTypes().length, n = getTreeNodes().length, p = getExtraParams().length;
  el.style.color = (n||p) ? "#4dff91" : "#ff6b6b";
  el.textContent = (n||p) ? `✔ Синхронизировано: типов ${t}, узлов ${n}, параметров ${p}` : "✖ Нет данных из админки";
}

// ---------- IMAGES ----------
function dedupImages(arr){const s=new Set();return arr.filter(f=>{const k=`${f.name}|${f.size}`;if(s.has(k))return false;s.add(k);return true;});}
function fileToDataUrl(file){return new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(file);});}
function renderImagePreview(pre){pre.innerHTML="";selectedImages.forEach(img=>{const el=document.createElement("img");el.src=img.dataUrl;el.alt=img.name;pre.appendChild(el);});}
function attachImagesHandler(){
  const input=$("images"), preview=$("imagePreview");
  input.onchange=async()=>{
    const files=Array.from(input.files||[]);
    for(const f of files){selectedImages.push({name:f.name,size:f.size,dataUrl:await fileToDataUrl(f)});}
    selectedImages=dedupImages(selectedImages); renderImagePreview(preview); input.value="";
  };
}

// ---------- MAP POINT PICK ----------
function attachPickOnMap(){
  const btn=$("pickOnMap"), badge=$("coordsBadge");
  if (!btn) return;
  btn.onclick=()=>{ pickMode=true; badge.textContent="Кликните по карте…"; badge.style.background="#444d"; };
  if (!map) return;
  map.on("click",(e)=>{
    if(!pickMode) return;
    tempCoords={lat:e.latlng.lat,lng:e.latlng.lng};
    badge.textContent=`Выбрано: ${tempCoords.lat.toFixed(5)}, ${tempCoords.lng.toFixed(5)}`;
    badge.style.background="#242938"; pickMode=false;
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([tempCoords.lat, tempCoords.lng], {opacity:0.6}).addTo(map);
  });
}

// ---------- SAVE FORM ----------
function attachFormSubmit(){
  const form=$("objectForm"); if (!form) return;
  $("clearForm").onclick=()=>resetForm();
  form.onsubmit=(ev)=>{
    ev.preventDefault();
    const loc={}; getNodeTypes().forEach(t=>{const el=$(`form_${t}`); if(el && el.value) loc[t]=+el.value;});
    const extra={}; document.querySelectorAll('#dynamicParamsForm input[type="checkbox"]').forEach(cb=>{const n=cb.dataset.param; extra[n]=extra[n]||[]; if(cb.checked) extra[n].push(cb.value);});
    const obj={
      id:Date.now(),
      status:$("form_status").value||"",
      title:$("title").value.trim(),
      address:$("address").value.trim(),
      price:+($("price").value||0), area:+($("area").value||0),
      rooms:+($("rooms").value||0), floor:+($("floor").value||0), floors:+($("floors").value||0),
      year:+($("year").value||0),
      loc, extra, images:selectedImages.slice(0),
      coords: tempCoords ? {...tempCoords} : null,
      createdAt:Date.now()
    };
    objects.push(obj);
    localStorage.setItem(LS_OBJECTS, JSON.stringify(objects));
    localStorage.setItem("objects_last_change", String(Date.now()));
    resetForm(); renderAll(true);
  };
}
function resetForm(){
  ["title","address","price","area","rooms","floor","floors","year"].forEach(id=>{const el=$(id); if(el) el.value="";});
  getNodeTypes().forEach(t=>{const el=$(`form_${t}`); if(el) el.value="";});
  $("form_status").value="sale"; $("dynamicParamsForm").innerHTML="";
  selectedImages=[]; $("imagePreview").innerHTML="";
  tempCoords=null; if (tempMarker){map.removeLayer(tempMarker); tempMarker=null;}
  const b=$("coordsBadge"); if(b) b.textContent="Координаты не выбраны";
}

// ---------- FILTER APPLY ----------
function gatherActiveFilters(){
  const filters={byType:{},status:null,params:{}};
  getNodeTypes().forEach(t=>{const el=$(`filter_${t}`); if(el && el.value) filters.byType[t]=+el.value;});
  const st=$("filter_status"); if(st && st.value) filters.status=st.value;
  document.querySelectorAll('#dynamicParamsFilters input[type="checkbox"]').forEach(cb=>{
    if(!cb.checked) return; const n=cb.dataset.param; filters.params[n]=filters.params[n]||new Set(); filters.params[n].add(cb.value);
  });
  return filters;
}
function applyFilters(list){
  const f=gatherActiveFilters(); let res=list.slice();
  Object.entries(f.byType).forEach(([t,id])=>{res=res.filter(o=>o.loc && o.loc[t]===id);});
  if (f.status) res=res.filter(o=>o.status===f.status);
  Object.entries(f.params).forEach(([n,set])=>{
    res=res.filter(o=>{const got=new Set(o.extra?.[n]||[]); for(const v of set){ if(got.has(v)) return true; } return false;});
  });
  return res;
}

// ---------- RENDER ----------
function renderMarkers(list=objects){
  if (!cluster) return;
  cluster.clearLayers();
  list.forEach(o=>{
    if(!o.coords) return;
    const catType=detectCategoryType();
    const catName=catType && o.loc?.[catType] ? nameById(o.loc[catType]) : "";
    const pRooms=o.rooms?`${o.rooms}`:"";
    const pArea=o.area?`${fmtNum(o.area)} м²`:"";
    const pFloor=(o.floor||o.floors)?[o.floor?`этаж ${o.floor}`:"",o.floors?`из ${o.floors}`:""].filter(Boolean).join(" "):"";
    const pYear=o.year?`${o.year}`:"";
    const thumbs=(o.images||[]).slice(0,2).map(im=>`<img src="${im.dataUrl}" alt="" style="width:56px;height:42px;object-fit:cover;border-radius:4px;margin-right:4px">`).join("");
    const html=`
      <div style="min-width:210px">
        <b>${o.title||"(без названия)"}</b> ${catName?`<span class="badge">${catName}</span>`:""}<br/>
        ${o.price?`<div class="price" style="margin:6px 0">${fmtNum(o.price)} сум</div>`:""}
        ${pRooms?`<div class="meta">Комнаты: ${pRooms}</div>`:""}
        ${pArea?`<div class="meta">Площадь: ${pArea}</div>`:""}
        ${pFloor?`<div class="meta">Этажность: ${pFloor}</div>`:""}
        ${pYear?`<div class="meta">Год: ${pYear}</div>`:""}
        ${o.address?`<div class="meta">${o.address}</div>`:""}
        ${thumbs?`<div style="margin-top:6px;display:flex;align-items:center">${thumbs}${o.images.length>2?`<span class="badge">+${o.images.length-2}</span>`:""}</div>`:""}
      </div>`;
    const m=L.marker([o.coords.lat,o.coords.lng]); m.bindPopup(html); cluster.addLayer(m);
  });
}
function renderResults(list=objects){
  const wrap=$("resultsList"); if(!wrap) return;
  wrap.innerHTML="";
  if(!list.length){wrap.innerHTML=`<div class="muted">Нет объектов</div>`; return;}
  list.forEach(o=>{
    const card=document.createElement("div"); card.className="item";
    const catType=detectCategoryType(); const catName=catType && o.loc?.[catType] ? nameById(o.loc[catType]) : "";
    const pRooms=o.rooms?`${o.rooms}`:""; const pArea=o.area?`${fmtNum(o.area)} м²`:"";
    const pFloor=(o.floor||o.floors)?[o.floor?`этаж ${o.floor}`:"",o.floors?`из ${o.floors}`:""].filter(Boolean).join(" "):"";
    const pYear=o.year?`${o.year}`:"";
    const maxThumbs=8;
    const thumbs=(o.images||[]).slice(0,maxThumbs).map(im=>`<img src="${im.dataUrl}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:4px;margin-right:4px;margin-top:4px">`).join("");
    card.innerHTML=`
      <h3>${o.title||"(без названия)"} ${catName?`<span class="badge">${catName}</span>`:""}</h3>
      <div class="price">${o.price?`${fmtNum(o.price)} сум`:""}</div>
      <div class="meta">${o.address||""}</div>
      <div class="meta" style="margin-top:6px">
        ${pRooms?`<span class="badge" style="margin-right:6px">Комнаты: ${pRooms}</span>`:""}
        ${pArea?`<span class="badge" style="margin-right:6px">Площадь: ${pArea}</span>`:""}
        ${pFloor?`<span class="badge" style="margin-right:6px">Этажность: ${pFloor}</span>`:""}
        ${pYear?`<span class="badge" style="margin-right:6px">Год: ${pYear}</span>`:""}
      </div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;align-items:center">
        ${thumbs}${(o.images?.length||0)>maxThumbs?`<span class="badge" style="margin-top:4px">+${o.images.length-maxThumbs}</span>`:""}
      </div>`;
    wrap.appendChild(card);
  });
}

function renderAll(fromFilters=false){
  try{
    if (!fromFilters){ // полная пересборка при первом рендере/изменениях из стореджа
      buildFilters(); buildForm(); renderParamsForm();
    }else{
      // если пришли из onchange фильтров — не пересоздаём форму, только данные
      updateAdminSyncInfo(); buildParamsFilters();
    }
    const filtered = applyFilters(objects);
    renderMarkers(filtered);
    renderResults(filtered);
    statusOK("Скрипт загружен и работает");
  }catch(e){
    statusERR("Ошибка рендера: "+e.message);
    console.error(e);
  }
}

// ---------- STORAGE SYNC ----------
window.addEventListener("storage",(e)=>{
  if (["treeNodes","nodeTypes","extraParams","objects","objects_last_change"].includes(e.key)) {
    objects = JSON.parse(localStorage.getItem(LS_OBJECTS) || "[]");
    renderAll();
  }
});

// ---------- INIT ----------
function init(){
  safeInitMap();        // карта с защитой
  attachImagesHandler();
  attachFormSubmit();
  renderAll();          // полная сборка
  attachPickOnMap();    // после карты
}
init();
