/*
 * CẤU HÌNH 5 THƯƠNG HIỆU
 * Cả 5 tên miền dùng chung một mã nguồn. Trang tự nhận tên miền đang mở
 * và lấy đúng tên, ấn triện, màu nhấn, phim nổi bật và các hàng phim.
 *
 * rows[].filter có thể là:
 *   { trending: true }        – xem nhiều nhất
 *   { newest: true }          – mới cập nhật
 *   { airing: true }          – phim bộ đang chiếu
 *   { type: "bo" | "le" | "ngan" }
 *   { genre: "Tu tiên" }      – theo thể loại (viết đúng như trong GENRES)
 */
window.SITES = [
  {
    id: "xuongphim", domain: "xuongphim.ai",
    name: "Xưởng Phim", seal: "坊",
    tagline: "Xưởng phim cổ trang AI",
    accent: "#D9A441", onAccent: "#1C1204",
    featured: "van-co-tien-do",
    rows: [
      { title: "Mới ra lò", filter: { newest: true } },
      { title: "Tu tiên", filter: { genre: "Tu tiên" } },
      { title: "Kiếm hiệp", filter: { genre: "Kiếm hiệp" } },
      { title: "Phim ngắn", filter: { type: "ngan" } }
    ]
  },
  {
    id: "khophim", domain: "khophim.ai",
    name: "Kho Phim", seal: "库",
    tagline: "Kho phim cổ trang AI, tìm là có",
    accent: "#4FB08F", onAccent: "#04201A",
    featured: "phuong-te-cung",
    rows: [
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "Cung đấu", filter: { genre: "Cung đấu" } },
      { title: "Lịch sử", filter: { genre: "Lịch sử" } },
      { title: "Phim lẻ", filter: { type: "le" } }
    ]
  },
  {
    id: "phephim", domain: "phephim.ai",
    name: "Phê Phim", seal: "醉",
    tagline: "Phim võ hiệp AI xem là phê",
    accent: "#E0566B", onAccent: "#2A0610",
    featured: "huyet-nguyet-thanh",
    rows: [
      { title: "Hành động", filter: { genre: "Hành động" } },
      { title: "Kiếm hiệp", filter: { genre: "Kiếm hiệp" } },
      { title: "Huyền huyễn", filter: { genre: "Huyền huyễn" } },
      { title: "Phim ngắn", filter: { type: "ngan" } }
    ]
  },
  {
    id: "phimhay", domain: "phimhay.ai",
    name: "Phim Hay", seal: "好",
    tagline: "Tuyển chọn phim cổ trang AI đáng xem",
    accent: "#E8673A", onAccent: "#2A0C02",
    featured: "kiem-khach-vo-danh",
    rows: [
      { title: "Xem nhiều nhất", filter: { trending: true } },
      { title: "Tâm lý", filter: { genre: "Tâm lý" } },
      { title: "Tình cảm", filter: { genre: "Tình cảm" } },
      { title: "Phim lẻ", filter: { type: "le" } }
    ]
  },
  {
    id: "ghienphim", domain: "ghienphim.ai",
    name: "Ghiền Phim", seal: "迷",
    tagline: "Phim bộ cổ trang AI cày hoài không chán",
    accent: "#A68BE0", onAccent: "#140A33",
    featured: "ho-ly-nui-tuyet",
    rows: [
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "Phim bộ trọn bộ", filter: { type: "bo" } },
      { title: "Tu tiên", filter: { genre: "Tu tiên" } },
      { title: "Huyền huyễn", filter: { genre: "Huyền huyễn" } }
    ]
  }
];
