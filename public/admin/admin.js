/* ============================
   ADMIN PANEL — FIXED VERSION
   ============================ */

// Short helper
const qs = sel => document.querySelector(sel);
const toast = (msg, dur = 2000) => {
    const t = qs("#toast");
    t.textContent = msg;
    t.style.display = "block";
    setTimeout(() => t.style.display = "none", dur);
};

/* ============================
   LOAD PRODUK DARI BACKEND
   ============================ */
async function loadProducts() {
    try {
        const res = await fetch("/admin/produk", {
            method: "GET",
            credentials: "include"
        });

        const j = await res.json();
        if (Array.isArray(j.produk)) return j.produk;

        return [];
    } catch (err) {
        console.error("Load error:", err);
        return [];
    }
}

/* ============================
   RENDER PRODUK
   ============================ */
async function render() {
    const products = await loadProducts();
    const grid = qs("#productGrid");
    grid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement("div");
        card.className = "card-admin";

        card.innerHTML = `
            <div class="card-thumb">
                <img src="${p.img || '/uploads/placeholder.jpg'}">
            </div>

            <input class="card-input" data-field="name" value="${escapeHtml(p.name || '')}">
            <input class="card-input" data-field="cat" value="${escapeHtml(p.cat || '')}">

            <div class="card-row">
                <input class="card-input" data-field="price" value="${p.price || 0}">
                <input class="card-input" data-field="qris" value="${escapeHtml(p.qris || '')}" placeholder="QRIS URL">
            </div>

            <textarea class="card-input" data-field="desc">${escapeHtml(p.desc || '')}</textarea>

            <div style="display:flex;gap:8px">
                <input class="card-input" data-field="img" value="${escapeHtml(p.img || '')}" placeholder="Image URL">
                <input type="file" class="upload-file" data-id="${p.id}" accept="image/*">
            </div>

            <div class="card-actions">
                <button class="primary save-btn" data-id="${p.id}">Simpan</button>
                <button class="ghost delete-btn" data-id="${p.id}">Hapus</button>
            </div>
        `;

        /* =============== Upload File per produk =============== */
        const fileInput = card.querySelector(".upload-file");
        fileInput.addEventListener("change", async (ev) => {
            const f = ev.target.files[0];
            if (!f) return;

            const fd = new FormData();
            fd.append("file", f);

            try {
                const up = await fetch("/api/admin/upload", { method: "POST", body: fd });
                const j = await up.json();

                if (j.url) {
                    card.querySelector("input[data-field='img']").value = j.url;
                    card.querySelector(".card-thumb img").src = j.url;
                    toast("Upload sukses");
                }
            } catch {
                toast("Upload gagal");
            }
        });

        /* =============== SAVE PRODUK =============== */
        card.querySelector(".save-btn").addEventListener("click", async () => {
            const payload = gatherCardData(card, p.id);

            await fetch(`/api/admin/edit/${p.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            toast("Tersimpan");
            render();
        });

        /* =============== DELETE PRODUK =============== */
        card.querySelector(".delete-btn").addEventListener("click", async () => {
            if (!confirm("Yakin hapus produk ini?")) return;

            await fetch(`/api/admin/delete/${p.id}`, {
                method: "POST",
                credentials: "include"
            });

            toast("Terhapus");
            render();
        });

        grid.appendChild(card);
    });
}

/* ============================
   AMBIL DATA CARD
   ============================ */
function gatherCardData(card, id) {
    return {
        id,
        name: card.querySelector("input[data-field='name']").value,
        cat: card.querySelector("input[data-field='cat']").value,
        price: Number(card.querySelector("input[data-field='price']").value) || 0,
        desc: card.querySelector("textarea[data-field='desc']").value,
        img: card.querySelector("input[data-field='img']").value,
        qris: card.querySelector("input[data-field='qris']").value || ""
    };
}

/* ============================
   ESCAPE HTML
   ============================ */
function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[m]));
}

/* ============================
   TAMBAH PRODUK BARU
   ============================ */
qs("#addBtn").addEventListener("click", async () => {
    const name = qs("#newName").value.trim();
    if (!name) return toast("Nama wajib diisi");

    const cat = qs("#newCat").value.trim() || "panel";
    const price = Number(qs("#newPrice").value) || 0;
    const imgUrl = qs("#newImg").value.trim();
    const qris = qs("#newQris").value.trim();

    let finalImg = imgUrl;

    const file = qs("#newFile").files[0];
    if (file) {
        const fd = new FormData();
        fd.append("file", file);

        const up = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const j = await up.json();
        if (j.url) finalImg = j.url;
    }

    await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            name,
            desc: qs("#newDesc").value,
            price,
            img: finalImg,
            cat,
            qris
        })
    });

    toast("Produk ditambahkan");
    clearAddForm();
    render();
});

function clearAddForm() {
    ["#newName", "#newCat", "#newPrice", "#newImg", "#newQris", "#newDesc"]
        .forEach(sel => qs(sel).value = "");
    qs("#newFile").value = "";
}

qs("#refreshBtn").addEventListener("click", render);
qs("#clearBtn").addEventListener("click", clearAddForm);

/* ============================
   PROTECT ADMIN PAGE
   ============================ */
async function protectPage() {
    try {
        const res = await fetch("/admin/check", { credentials: "include" });
        const j = await res.json();

        if (!j.auth) window.location.href = "/admin/login";
    } catch {
        window.location.href = "/admin/login";
    }
}

protectPage();
render();

/* ============================
   DROPZONE UPLOAD
   ============================ */
const dropzone = qs("#dropzone");
const fileInput = qs("#newFile");
const fileName = qs("#fileName");

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files;

    handleFile(file);
});

function handleFile(file) {
    if (!file) return;
    fileName.textContent = `File dipilih: ${file.name}`;
}