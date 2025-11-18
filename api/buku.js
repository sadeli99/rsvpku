// api/buku.js
// API Buku Tamu dinamis berdasarkan pasangan (ambil token + URL Upstash dari API pengantin)

// 🔎 Ambil token & URL Upstash dari API pengantin
async function getPasanganConfig(pasangan) {
  // Pastikan endpoint-nya benar → ini API pengantin
  const r = await fetch(`https://ipa-green.vercel.app/api/pengantin?namaPasangan=${pasangan}&tokenpasangan=true`);

  if (!r.ok) throw new Error("Gagal mengambil konfigurasi pasangan");

  return await r.json();
}

export default async function handler(req, res) {
  const pasangan = req.query.pasangan;
  if (!pasangan) {
    return res.status(400).json({
      error: "Parameter ?pasangan= wajib diisi."
    });
  }

  // 🔥 Ambil konfigurasi pasangan (Upstash URL + Token)
  let pasanganConfig;
  try {
    pasanganConfig = await getPasanganConfig(pasangan);
  } catch (err) {
    console.error("❌ Gagal ambil config pasangan:", err);
    return res.status(500).json({
      error: "Config pasangan tidak ditemukan"
    });
  }

  // Ambil data Upstash dari API pengantin
  const UPSTASH_URL = pasanganConfig.upstash_url;
  const AUTH_TOKEN = pasanganConfig.upstash_token;

  if (!UPSTASH_URL || !AUTH_TOKEN) {
    return res.status(500).json({
      error: "Upstash URL/token tidak lengkap untuk pasangan ini"
    });
  }

  // ==== CORS ====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ==== Helper: ambil & simpan data ====
  async function getData() {
    const r = await fetch(`${UPSTASH_URL}/get/buku:${pasangan}`, {
      headers: { Authorization: AUTH_TOKEN },
    });

    const data = await r.json();

    try {
      return data.result ? JSON.parse(data.result) : { tamu: [] };
    } catch {
      return { tamu: [] };
    }
  }

  async function saveData(newData) {
    const r = await fetch(`${UPSTASH_URL}/set/buku:${pasangan}`, {
      method: "POST",
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(newData),
    });

    return await r.json();
  }

  // ==== GET daftar tamu ====
  if (req.method === "GET") {
    try {
      const data = await getData();
      return res.status(200).json(data);
    } catch (err) {
      console.error("❌ GET Error:", err);
      return res.status(500).json({ error: "Gagal mengambil data" });
    }
  }

  // ==== POST buku tamu ====
  if (req.method === "POST") {
    try {
      let body = "";
      await new Promise((resolve) => {
        req.on("data", (chunk) => (body += chunk));
        req.on("end", resolve);
      });

      const { nama, pesan } = JSON.parse(body || "{}");

      if (!nama || !pesan) {
        return res.status(400).json({ error: "Data tidak lengkap" });
      }

      const data = await getData();
      const newTamu = {
        nama,
        pesan,
        waktu: new Date().toISOString()
      };

      data.tamu.push(newTamu);
      await saveData(data);

      return res.status(200).json({
        success: true,
        data: newTamu
      });
    } catch (err) {
      console.error("❌ POST Error:", err);
      return res.status(500).json({ error: "Gagal menyimpan tamu" });
    }
  }

  // ==== DELETE tamu ====
  if (req.method === "DELETE") {
    try {
      let body = "";
      await new Promise((resolve) => {
        req.on("data", (chunk) => (body += chunk));
        req.on("end", resolve);
      });

      const { nama } = JSON.parse(body || "{}");

      if (!nama) {
        return res.status(400).json({ error: "Nama wajib diisi" });
      }

      const data = await getData();
      data.tamu = data.tamu.filter((t) => t.nama !== nama);

      await saveData(data);

      return res.status(200).json({
        success: true,
        deleted: nama
      });
    } catch (err) {
      console.error("❌ DELETE Error:", err);
      return res.status(500).json({ error: "Gagal menghapus tamu" });
    }
  }

  return res.status(405).json({ error: "Method tidak diizinkan" });
}
