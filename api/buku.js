// api/buku.js
export default async function handler(req, res) {
  const UPSTASH_URL = "https://immune-civet-10584.upstash.io";
  const AUTH_TOKEN =
    process.env.UPSTASH_AUTH_TOKEN ||
    "Bearer ASlYAAIncDJhMjc4ZDRjYzU4NDM0M2E0OWUwY2Q0N2M3Y2RmZmI2ZnAyMTA1ODQ";

  // Ambil pasangan dari query
  const pasangan = req.query.pasangan;
  if (!pasangan) return res.status(400).json({ error: "Parameter ?pasangan wajib diisi" });

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Ambil data dari Redis
  async function getData() {
    const getRes = await fetch(`${UPSTASH_URL}/get/buku:${pasangan}`, {
      headers: { Authorization: AUTH_TOKEN }
    });
    const data = await getRes.json();
    return data.result ? JSON.parse(data.result) : { tamu: [] };
  }

  // Simpan data ke Redis
  async function saveData(data) {
    await fetch(`${UPSTASH_URL}/set/buku:${pasangan}`, {
      method: "POST",
      headers: { Authorization: AUTH_TOKEN, "Content-Type": "text/plain" },
      body: JSON.stringify(data)
    });
  }

  try {
    // GET → ambil semua tamu
    if (req.method === "GET") {
      const current = await getData();
      return res.status(200).json(current);
    }

    // POST → tambah tamu
    if (req.method === "POST") {
      const { nama, pesan } = req.body;
      if (!nama || !pesan) return res.status(400).json({ error: "Data tidak lengkap" });

      const current = await getData();
      const newTamu = { nama, pesan };
      current.tamu.push(newTamu);
      await saveData(current);
      return res.status(200).json({ success: true, data: newTamu });
    }

    // DELETE → hapus tamu berdasarkan nama
    if (req.method === "DELETE") {
      const { nama } = req.body;
      if (!nama) return res.status(400).json({ error: "Nama tamu wajib diisi" });

      const current = await getData();
      const filtered = current.tamu.filter(t => t.nama !== nama);
      current.tamu = filtered;
      await saveData(current);
      return res.status(200).json({ success: true, deleted: nama });
    }

    // Method lain tidak diizinkan
    return res.status(405).json({ error: "Method tidak diizinkan" });
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
