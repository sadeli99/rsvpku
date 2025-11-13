// api/rsvp.js
// RSVP Dinamis dengan Upstash sesuai pasangan

// 🔎 Ambil token & URL Upstash dari API pengantin
async function getPasanganConfig(pasangan) {
  const r = await fetch(`https://ipa-green.vercel.app/api/pengantin?namaPasangan=${pasangan}`);
  if (!r.ok) throw new Error("Gagal mengambil konfigurasi pasangan");
  return await r.json();
}

export default async function handler(req, res) {
  const pasangan = req.query.pasangan;

  if (!pasangan) {
    return res.status(400).json({
      error: "Parameter ?pasangan= wajib diisi.",
    });
  }

  // 🔥 Ambil konfigurasi pasangan (URL + token Upstash)
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
      error: "Upstash URL/token tidak tersedia untuk pasangan ini"
    });
  }

  // ==== CORS ====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ==== GET ALL RSVP ====
  if (req.method === "GET") {
    try {
      const r = await fetch(`${UPSTASH_URL}/get/rsvp:${pasangan}`, {
        headers: { Authorization: AUTH_TOKEN },
      });

      const data = await r.json();
      const result = data.result ? JSON.parse(data.result) : [];

      return res.status(200).json(result);
    } catch (err) {
      console.error("❌ Error GET:", err);
      return res.status(500).json({ error: "Gagal mengambil data RSVP" });
    }
  }

  // ==== POST RSVP ====
  if (req.method === "POST") {
    try {
      // Ambil body secara manual (supaya kompatibel dengan semua hosting)
      let body = "";
      await new Promise((resolve) => {
        req.on("data", (chunk) => (body += chunk));
        req.on("end", resolve);
      });

      const { nama, hadir, ucapan } = JSON.parse(body || "{}");

      if (!nama || !hadir || !ucapan) {
        return res.status(400).json({ error: "Data tidak lengkap" });
      }

      // Ambil data RSVP lama
      const getRes = await fetch(`${UPSTASH_URL}/get/rsvp:${pasangan}`, {
        headers: { Authorization: AUTH_TOKEN },
      });

      const getData = await getRes.json();
      const list = getData.result ? JSON.parse(getData.result) : [];

      // Data baru
      const newData = {
        nama,
        hadir,
        ucapan,
        waktu: new Date().toISOString(),
      };

      list.push(newData);

      // Simpan kembali ke Upstash
      await fetch(`${UPSTASH_URL}/set/rsvp:${pasangan}`, {
        method: "POST",
        headers: {
          Authorization: AUTH_TOKEN,
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(list),
      });

      return res.status(200).json({
        success: true,
        pasangan,
        data: newData,
        total: list.length,
      });
    } catch (err) {
      console.error("❌ Error POST:", err);
      return res.status(500).json({ error: "Gagal menyimpan RSVP" });
    }
  }

  return res.status(405).json({ error: "Method tidak diizinkan" });
}
