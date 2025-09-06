console.log("✅ script.js v13.3 loaded");

let objects = [
  {id:1, title:"Квартира на Навои", price:50000, rooms:3, city:"Ташкент", district:"Мирабад", street:"ул. Навои", category:"Квартиры"},
  {id:2, title:"Дом в Юнусабаде", price:150000, rooms:5, city:"Ташкент", district:"Юнусабад", street:"массив Восточный", category:"Дома"}
];

// Загружаем дерево из localStorage (из админки)
let treeNodes = JSON.parse(localStorage.getItem("treeNodes") || "[]");

// Получение дочерних узлов
function getChildren(parentId){
  return treeNodes.filter(n=>n.parent===parentId);
}

// Заполнение select
function fillSelect(id, type){
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">${type}</option>`;
  treeNodes.filter(n=>n.type===type).forEach(n=>{
    sel.innerHTML += `<option value="${n.name}">${n.name}</option>`;
  });
}

// Инициализация фильтров
function initFilters(){
  fillSelect("cityFilter", "Город");
  fillSelect("districtFilter", "Район");
  fillSelect("streetFilter", "Улица");
  fillSelect("categoryFilter", "Категория");
}

function renderList(){
  const list = document.getElementById("resultsList");
  list.innerHTML = "";
  objects.forEach(o=>{
    const div = document.createElement("div");
    div.className = "result-card";
    div.textContent = `${o.title} — ${o.price}$ — ${o.rooms} комн. — ${o.city}, ${o.district}`;
    list.appendChild(div);
  });
}

initFilters();
renderList();
