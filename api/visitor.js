// api/visitor.js
// Visitor tracker dinamis berdasarkan pasangan (ambil token & URL Upstash dari API pengantin)

// 🔎 Ambil token & URL Upstash dari API pengantin
async function getPasanganConfig(pasangan) {
  const r = await fetch(`https://ipa-green.vercel.app/api/pengantin?namaPasangan=${pasangan}&tokenpasangan=true`);
  if (!r.ok) throw new Error("Gagal mengambil konfigurasi pasangan");
  return await r.json();
}

export default async function handler(req, res) {
  const pasangan = req.query.pasangan;
  const tamu = req.query.to;
  const view = req.query.view;

  if (!pasangan)
    return res.status(400).json({ error: "Parameter ?pasangan wajib diisi" });

  // 🔥 Ambil konfigurasi pasangan (Upstash URL + Token)
  let pasanganConfig;
  try {
    pasanganConfig = await getPasanganConfig(pasangan);
  } catch (err) {
    console.error("❌ Gagal ambil config pasangan:", err);
    return res.status(500).json({ error: "Config pasangan tidak ditemukan" });
  }

  const UPSTASH_URL = pasanganConfig.upstash_url;
  const AUTH_TOKEN = pasanganConfig.upstash_token;

  if (!UPSTASH_URL || !AUTH_TOKEN) {
    return res.status(500).json({
      error: "Upstash URL/token tidak lengkap untuk pasangan ini"
    });
  }

  // ==== CORS ====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ==== Fungsi bantu ====
  async function getData() {
    const getRes = await fetch(`${UPSTASH_URL}/get/visitor:${pasangan}`, {
      headers: { Authorization: AUTH_TOKEN },
    });

    const data = await getRes.json();

    try {
      if (!data.result) return { pengunjung: [] };

      const parsed = JSON.parse(data.result);

      // Auto deteksi struktur lama
      if (parsed.visitors && Array.isArray(parsed.visitors))
        return { pengunjung: parsed.visitors };

      if (parsed.pengunjung && Array.isArray(parsed.pengunjung))
        return { pengunjung: parsed.pengunjung };

      return { pengunjung: [] };
    } catch {
      return { pengunjung: [] };
    }
  }

  async function saveData(data) {
    await fetch(`${UPSTASH_URL}/set/visitor:${pasangan}`, {
      method: "POST",
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(data),
    });
  }

  try {
    // ==== GET Semua visitor ====
    if (req.method === "GET") {
      const data = await getData();

      if (view === "all") {
        return res.status(200).json({
          pasangan,
          totalPengunjung: data.pengunjung.length,
          pengunjung: data.pengunjung,
        });
      }

      return res.status(200).json({
        pasangan,
        totalPengunjung: data.pengunjung.length,
      });
    }

    // ==== POST Tambah visitor ====
    if (req.method === "POST") {
      if (!tamu)
        return res.status(400).json({
          error: "Parameter ?to (nama tamu) wajib diisi",
        });

      const current = await getData();

      const sudahAda = current.pengunjung.find(
        (v) => v.nama.toLowerCase() === tamu.toLowerCase()
      );

      if (sudahAda) {
        return res.status(200).json({
          success: false,
          message: "Tamu sudah pernah berkunjung",
        });
      }

      const newVisitor = {
        nama: tamu,
        waktu: new Date().toISOString(),
      };

      current.pengunjung.push(newVisitor);
      await saveData({ pengunjung: current.pengunjung });

      return res.status(200).json({
        success: true,
        message: "Pengunjung baru tercatat",
        data: newVisitor,
      });
    }

    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    console.error("❌ Visitor API Error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
