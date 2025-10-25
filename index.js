export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Content-Type", "application/json");

  return res.status(200).json({
    status: "✅ API aktif dan berjalan dengan baik!",
    endpoints: {
      rsvp: "/api/rsvp?pasangan=nama-pengantin",
      buku: "/api/buku?pasangan=nama-pengantin"
    },
    author: "mezurer",
    timestamp: new Date().toISOString()
  });
}
