// api/visitor.js
export default async function handler(req, res) {
  const UPSTASH_URL = "https://immune-civet-10584.upstash.io";
  const AUTH_TOKEN =
    process.env.UPSTASH_AUTH_TOKEN ||
    "Bearer ASlYAAIncDJhMjc4ZDRjYzU4NDM0M2E0OWUwY2Q0N2M3Y2RmZmI2ZnAyMTA1ODQ";

  // Ambil pasangan & tamu dari query
  const pasangan = req.query.pasangan;
  const tamu = req.query.to;
  if (!pasangan) return res.status(400).json({ error: "Parameter ?pasangan wajib diisi" });
  if (!tamu) return res.status(400).json({ error: "Parameter ?to wajib diisi" });

  // ==== CORS ====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ==== Ambil data dari Redis ====
  async function getData() {
    const r = await fetch(`${UPSTASH_URL}/get/visitor:${pasangan}`, {
      headers: { Authorization: AUTH_TOKEN },
    });
    const data = await r.json();
    try {
      return data.result ? JSON.parse(data.result) : { visitors: [] };
    } catch {
      return { visitors: [] };
    }
  }

  // ==== Simpan data ke Redis ====
  async function saveData(newData) {
    await fetch(`${UPSTASH_URL}/set/visitor:${pasangan}`, {
      method: "POST",
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(newData),
    });
  }

  try {
    // GET: ambil semua visitor
    if (req.method === "GET") {
      const current = await getData();
      return res.status(200).json({
        total: current.visitors.length,
        visitors: current.visitors,
      });
    }

    // POST: catat visitor baru (hanya sekali)
    if (req.method === "POST") {
      const current = await getData();

      // Cek apakah tamu sudah pernah tercatat
      const sudahAda = current.visitors.some(
        (v) => v.nama.toLowerCase() === tamu.toLowerCase()
      );

      if (sudahAda) {
        return res.status(200).json({
          message: "✅ Tamu sudah tercatat sebelumnya, tidak dihitung lagi.",
          total: current.visitors.length,
        });
      }

      // Tambah tamu baru
      const newVisitor = { nama: tamu, waktu: new Date().toISOString() };
      current.visitors.push(newVisitor);
      await saveData(current);

      return res.status(200).json({
        success: true,
        message: "Tamu baru dicatat.",
        total: current.visitors.length,
      });
    }

    // Jika method lain
    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
