/* ------------------- TYPING EFFECT -------------------- */
const text = "WELCOME TO AWANG OFFICIAL";
const container = document.getElementById("typingText");
let idx = 0;

function typeEffect() {
  if (idx < text.length) {
    container.textContent += text.charAt(idx);
    idx++;
    setTimeout(typeEffect, 55);
  }
}
typeEffect();


/* ================== LOAD PRODUK JSON =================== */
let products = [];

fetch("./produk.json")
  .then(res => res.json())
  .then(data => {
    console.log("Loaded:", data);
    
    // FIX UTAMA ▌produk.json = { "produk": [...] }
    products = data.produk || [];

    if (!Array.isArray(products)) {
      console.error("FORMAT produk.json SALAH!");
      products = [];
    }

    renderProducts(products);
  })
  .catch(err => console.error("Gagal load produk:", err));


/* ================== FILTER KATEGORI ==================== */
const catBtns = document.querySelectorAll(".cat-btn");

catBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".cat-btn.active")?.classList.remove("active");
    btn.classList.add("active");

    const category = btn.dataset.cat;

    if (category === "all") {
      renderProducts(products);
    } else {
      const filtered = products.filter(p => p.cat === category);
      renderProducts(filtered);
    }
  });
});


/* ==================== RENDER PRODUK ==================== */
const productList = document.getElementById("productList");

function formatRupiah(n) {
  return "Rp " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function renderProducts(list) {
  productList.innerHTML = "";

  if (!list.length) {
    productList.innerHTML = `<div class="no-data">Tidak ada produk.</div>`;
    return;
  }

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <img class="thumb" src="${p.img}">
      <div class="title">${p.name}</div>
      <div class="desc">${p.desc}</div>
      <div class="price">${formatRupiah(p.price)}</div>
      <button class="btn" data-id="${p.id}">Beli Sekarang</button>
    `;
    productList.appendChild(el);
  });

  observeCards();
}


/* ================== ANIMASI CARD ==================== */
function observeCards() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: .2 });

  document.querySelectorAll(".card").forEach(c => observer.observe(c));
}


/* ===================== MODAL ========================= */
const modal = document.getElementById("modalBackdrop");
const qrisImage = document.getElementById("qrisImage");
const payInfo = document.getElementById("payInfo");
const waLink = document.getElementById("waLink");

function openModal(id) {
  const p = products.find(x => x.id == id);

  qrisImage.src = p.qris;
  payInfo.textContent = `${p.name} — ${formatRupiah(p.price)}`;
  waLink.href = `https://wa.me/6283178194062?text=${
    encodeURIComponent("Halo, saya ingin kirim bukti transfer " + p.name)
  }`;

  modal.style.display = "flex";
}

function closeM() {
  modal.style.display = "none";
  qrisImage.src = "";
}

document.addEventListener("click", e => {
  if (e.target.matches(".btn")) openModal(Number(e.target.dataset.id));
  if (e.target === modal) closeM();
});

document.getElementById("closeModal").onclick = closeM;
document.getElementById("modalCloseBtn").onclick = closeM;


/* ================== WELCOME NEXT BUTTON ================== */
const welcome = document.getElementById("welcome");
const nextBtn = document.getElementById("nextBtn");

nextBtn.addEventListener("click", () => {
  welcome.style.opacity = "0";
  welcome.style.pointerEvents = "none";
  setTimeout(() => welcome.style.display = "none", 400);
});


/* =================== DRAWER ======================= */
document.getElementById("openDrawer").onclick = () => {
  document.getElementById("drawer").classList.add("open");
};
document.getElementById("closeDrawer").onclick = () => {
  document.getElementById("drawer").classList.remove("open");
};


/* =================== SMOOTH SCROLL ================== */
document.documentElement.style.scrollBehavior = "smooth";