let currentObjects = JSON.parse(localStorage.getItem("objects")) || [];
let editingId = null;
let selectedImages = [];

// =============================
// ФОТО: сохраняем и редактируем
// =============================
document.getElementById("images").addEventListener("change", handleImageUpload);

function handleImageUpload(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      selectedImages.push(e.target.result);
      renderImagePreview();
    };
    reader.readAsDataURL(file);
  });
}

function renderImagePreview() {
  const preview = document.getElementById("imagePreview");
  preview.innerHTML = "";
  selectedImages.forEach((src, index) => {
    const div = document.createElement("div");
    div.classList.add("preview-item");
    div.innerHTML = `
      <img src="${src}" alt="preview">
      <button type="button" onclick="removeImage(${index})">✖</button>
    `;
    preview.appendChild(div);
  });
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  renderImagePreview();
}

function fillFormForEdit(object) {
  document.getElementById("title").value = object.title;
  document.getElementById("price").value = object.price;
  document.getElementById("rooms").value = object.rooms;
  document.getElementById("status").value = object.status;
  document.getElementById("category").value = object.category;
  selectedImages = [...object.images];
  renderImagePreview();
  editingId = object.id;
}

function saveObject() {
  const newObj = {
    id: editingId || Date.now(),
    title: document.getElementById("title").value,
    price: +document.getElementById("price").value,
    rooms: +document.getElementById("rooms").value,
    status: document.getElementById("status").value,
    category: document.getElementById("category").value,
    images: [...selectedImages],
    date: editingId ? currentObjects.find(o => o.id === editingId).date : Date.now()
  };

  if (editingId) {
    currentObjects = currentObjects.map(o => o.id === editingId ? newObj : o);
    editingId = null;
  } else {
    currentObjects.push(newObj);
  }

  localStorage.setItem("objects", JSON.stringify(currentObjects));
  renderObjects();
  clearForm();
}

function clearForm() {
  document.getElementById("objectForm").reset();
  selectedImages = [];
  document.getElementById("imagePreview").innerHTML = "";
}

// =============================
// СОРТИРОВКА
// =============================
document.getElementById("sortSelect").addEventListener("change", e => {
  const value = e.target.value;
  if (value === "priceAsc") {
    currentObjects.sort((a, b) => a.price - b.price);
  } else if (value === "priceDesc") {
    currentObjects.sort((a, b) => b.price - a.price);
  } else if (value === "dateNew") {
    currentObjects.sort((a, b) => b.date - a.date);
  } else if (value === "dateOld") {
    currentObjects.sort((a, b) => a.date - b.date);
  }
  renderObjects();
  localStorage.setItem("sort", value);
});

window.addEventListener("load", () => {
  const savedSort = localStorage.getItem("sort");
  if (savedSort) {
    document.getElementById("sortSelect").value = savedSort;
    document.getElementById("sortSelect").dispatchEvent(new Event("change"));
  }
  renderObjects();
});

// =============================
// Рендер объектов
// =============================
function renderObjects() {
  const list = document.getElementById("objectsList");
  list.innerHTML = "";
  currentObjects.forEach(obj => {
    const div = document.createElement("div");
    div.classList.add("object-card");
    div.innerHTML = `
      <h3>${obj.title}</h3>
      <p>Цена: ${obj.price}</p>
      <p>Комнат: ${obj.rooms}</p>
      <button onclick='fillFormForEdit(${JSON.stringify(obj)})'>Редактировать</button>
    `;
    list.appendChild(div);
  });
}

document.getElementById("objectForm").addEventListener("submit", e => {
  e.preventDefault();
  saveObject();
});
