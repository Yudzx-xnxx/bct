// server.js (ESM)
// Node 16+ recommended

import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

// ================= ESM __dirname fix =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= App init =================
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ================ Paths ================
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_PATH = path.join(__dirname, "produk.json");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");

// serve static
app.use(express.static(PUBLIC_DIR));

// ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ================ DB Helpers (normalizes many possible file shapes) ================
/**
 * loadDB() -> returns object { produk: [...] }
 * Works when file contains:
 *  - { "produk": [...] }
 *  - { "products": [...] }  (will convert)
 *  - [...] (array)         (will convert)
 *  - missing/invalid -> { produk: [] }
 */
function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // initialize correct structure
      const initial = { produk: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }

    const raw = fs.readFileSync(DB_PATH, "utf8").trim();
    if (!raw) {
      const initial = { produk: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }

    const parsed = JSON.parse(raw);

    // normalize shapes
    if (Array.isArray(parsed)) return { produk: parsed };
    if (typeof parsed === "object" && parsed !== null) {
      if (Array.isArray(parsed.produk)) return { produk: parsed.produk };
      if (Array.isArray(parsed.products)) return { produk: parsed.products };
      // unknown object -> try to find any array inside named produk/products
      return { produk: [] };
    }

    // fallback
    return { produk: [] };
  } catch (err) {
    console.error("loadDB error:", err);
    // attempt to repair file
    const initial = { produk: [] };
    try { fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2)); } catch(e){}
    return initial;
  }
}

/**
 * saveDB(objOrArray)
 * - if given array -> writes { produk: arr }
 * - if given object with produk -> writes { produk: [...] }
 */
function saveDB(input) {
  try {
    let out = null;
    if (Array.isArray(input)) {
      out = { produk: input };
    } else if (input && Array.isArray(input.produk)) {
      out = { produk: input.produk };
    } else {
      // fallback: create empty structure
      out = { produk: [] };
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(out, null, 2));
    return true;
  } catch (err) {
    console.error("saveDB error:", err);
    return false;
  }
}

// ================ Multer (upload) ================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.floor(Math.random() * 10000);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ================ Auth helpers ================
const requireAuthCookie = (req, res, next) => {
  if (req.cookies?.admin === "true") return next();
  // if AJAX call, return json; else redirect
  if (req.headers.accept && req.headers.accept.indexOf("application/json") !== -1) {
    return res.status(401).json({ auth: false, message: "Unauthorized" });
  }
  return res.redirect("/admin/login");
};

// ================ Routes ================

// root -> index.html (static will also serve it)
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// public frontend reads /produk.json
app.get("/produk.json", (req, res) => {
  // ensure file exists and normalized
  const db = loadDB();
  // respond with structure { produk: [...] } so front-end that expects that receives same
  res.json(db);
});

// Admin pages (static files under public/admin/*)
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin", "login.html"));
});
app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin", "dashboard.html"));
});

// admin check (used by protectPage)
app.get("/admin/check", (req, res) => {
  res.json({ auth: req.cookies?.admin === "true" });
});

// admin login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    res.cookie("admin", "true", { httpOnly: true, maxAge: 1000 * 60 * 60 * 6 });
    return res.json({ success: true });
  }
  return res.json({ success: false, message: "Username atau password salah" });
});

// admin logout
app.post("/admin/logout", (req, res) => {
  res.clearCookie("admin");
  res.json({ success: true });
});

// =============== Admin API: get produk list ===============
app.get("/admin/produk", requireAuthCookie, (req, res) => {
  const db = loadDB();           // { produk: [...] }
  // return the normalized object (ke admin code lama)
  res.json(db);
});

// =============== Public API alias for clients (read-only) ===============
app.get("/api/produk", (req, res) => {
  const db = loadDB();
  res.json(db.produk);
});

// =============== Upload endpoint (admin) ===============
app.post("/api/admin/upload", requireAuthCookie, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
  // return url path relative to public
  const url = "/uploads/" + req.file.filename;
  res.json({ ok: true, url });
});

// =============== Add product (admin) ===============
// Accepts JSON body: { name, desc, price, img, cat, qris }
// Endpoint alias: /api/admin/add and /api/produk/add
async function handleAddProduct(req, res) {
  try {
    const body = req.body || {};
    const { name, desc = "", price = 0, img = "", cat = "panel", qris = "" } = body;

    if (!name || name.toString().trim() === "") {
      return res.status(400).json({ ok: false, message: "Nama wajib" });
    }

    const db = loadDB(); // { produk: [...] }
    const list = Array.isArray(db.produk) ? db.produk : [];

    const newProduct = {
      id: Date.now(),         // numeric id
      name: name.toString(),
      desc: desc.toString(),
      price: Number(price) || 0,
      img: img.toString(),
      cat: cat.toString(),
      qris: qris.toString()
    };

    list.push(newProduct);
    saveDB({ produk: list });

    return res.json({ ok: true, product: newProduct });
  } catch (err) {
    console.error("add product error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}
app.post("/api/admin/add", requireAuthCookie, handleAddProduct);
app.post("/api/produk/add", requireAuthCookie, handleAddProduct);

// =============== Edit product (admin) ===============
// Accepts JSON or form-data (if file upload separate). Here we support JSON edits.
app.post("/api/admin/edit/:id", requireAuthCookie, upload.single("file"), (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = loadDB();
    const list = db.produk || [];
    const idx = list.findIndex(p => Number(p.id) === id);
    if (idx === -1) return res.status(404).json({ ok: false, message: "Produk tidak ditemukan" });

    const body = req.body || {};
    const { name, desc, price, img: imgUrl, cat, qris } = body;

    let imgFinal = list[idx].img || "";
    if (req.file) imgFinal = "/uploads/" + req.file.filename;
    else if (imgUrl) imgFinal = imgUrl;

    list[idx] = {
      ...list[idx],
      name: name !== undefined ? String(name) : list[idx].name,
      desc: desc !== undefined ? String(desc) : list[idx].desc,
      price: price !== undefined ? Number(price) : list[idx].price,
      img: imgFinal,
      cat: cat !== undefined ? String(cat) : list[idx].cat,
      qris: qris !== undefined ? String(qris) : (list[idx].qris || "")
    };

    saveDB({ produk: list });
    return res.json({ ok: true, product: list[idx] });
  } catch (err) {
    console.error("edit error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// =============== Delete product (admin) ===============
app.post("/api/admin/delete/:id", requireAuthCookie, (req, res) => {
  try {
    const id = Number(req.params.id);
    const db = loadDB();
    const list = db.produk || [];
    const newList = list.filter(p => Number(p.id) !== id);
    saveDB({ produk: newList });
    return res.json({ ok: true });
  } catch (err) {
    console.error("delete error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// =============== Fallback 404 =================
app.use((req, res) => {
  res.status(404).send("Not found");
});

// =============== Start =================
app.listen(PORT, () => {
  console.log(`Server berjalan → http://localhost:${PORT}`);
});