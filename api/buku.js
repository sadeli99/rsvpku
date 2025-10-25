// api/buku.js
// API Node.js untuk Buku Tamu Undangan

export default async function handler(req, res) {
  const UPSTASH_URL = "https://immune-civet-10584.upstash.io";
  const AUTH_TOKEN =
    process.env.UPSTASH_AUTH_TOKEN ||
    "Bearer ASlYAAIncDJhMjc4ZDRjYzU4NDM0M2E0OWUwY2Q0N2M3Y2RmZmI2ZnAyMTA1ODQ";

  // Ambil nama pasangan dari query
  const pasangan = req.query.pasangan;
  if (!pasangan) {
    return res.status(400).json({
      error: "Parameter ?pasangan=nama-pengantin wajib diisi.",
    });
  }

  // ==== CORS supaya bisa diakses dari mana saja ====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Fungsi bantu ambil & simpan data
  async function getData() {
    const r = await fetch(`${UPSTASH_URL}/get/buku:${pasangan}`, {
      headers: { Authorization: AUTH_TOKEN },
    });
    const data = await r.json();
    return data.result ? JSON.parse(data.result) : { tamu: [] };
  }

  async function saveData(newData) {
    await fetch(`${UPSTASH_URL}/set/buku:${pasangan}`, {
      method: "POST",
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(newData),
    });
  }

  // ==== GET → Ambil semua tamu ====
  if (req.method === "GET") {
    try {
      const data = await getData();
      return res.status(200).json(data);
    } catch (err) {
      console.error("❌ Error GET:", err);
      return res.status(500).json({ error: "Gagal mengambil data" });
    }
  }

  // ==== POST → Tambah tamu ====
  if (req.method === "POST") {
    try {
      const body = await req.json(); // penting agar body terbaca
      const { nama, pesan } = body;
      if (!nama || !pesan)
        return res.status(400).json({ error: "Data tidak lengkap" });

      const data = await getData();
      const newTamu = { nama, pesan, waktu: new Date().toISOString() };
      data.tamu.push(newTamu);
      await saveData(data);

      return res.status(200).json({ success: true, data: newTamu });
    } catch (err) {
      console.error("❌ Error POST:", err);
      return res.status(500).json({ error: "Gagal menyimpan data" });
    }
  }

  // ==== DELETE → Hapus tamu berdasarkan nama ====
  if (req.method === "DELETE") {
    try {
      const body = await req.json(); // penting agar body terbaca
      const { nama } = body;
      if (!nama)
        return res.status(400).json({ error: "Nama tamu wajib diisi" });

      const data = await getData();
      data.tamu = data.tamu.filter((t) => t.nama !== nama);
      await saveData(data);

      return res.status(200).json({ success: true, deleted: nama });
    } catch (err) {
      console.error("❌ Error DELETE:", err);
      return res.status(500).json({ error: "Gagal menghapus data" });
    }
  }

  return res.status(405).json({ error: "Method tidak diizinkan" });
}
