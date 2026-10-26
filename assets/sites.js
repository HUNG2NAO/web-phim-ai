/*
 * CẤU HÌNH 5 THƯƠNG HIỆU
 * world: "co-trang" (mặc định, phim cổ trang) hoặc "tuong-lai" (phim viễn tưởng, giao diện neon).
 *        Đổi phong cách một site chỉ cần sửa dòng này.
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
    id: "xuongphim", domain: "xuongphim.ai", world: "tuong-lai",
    name: "Xưởng Phim", seal: "XP",
    tagline: "Xưởng phim khoa học viễn tưởng AI",
    accent: "#3FD0F5", onAccent: "#03161D",
    featured: "thanh-pho-khong-ngu",
    rows: [
      { title: "Mới ra lò", filter: { newest: true } },
      { title: "Cyberpunk", filter: { genre: "Cyberpunk" } },
      { title: "Không gian", filter: { genre: "Không gian" } },
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
    id: "phephim", domain: "phephim.ai", world: "tuong-lai",
    name: "Phê Phim", seal: "PP",
    tagline: "Phim hành động tương lai AI xem là phê",
    accent: "#FF4F7B", onAccent: "#2B0410",
    featured: "duong-dua-neon",
    rows: [
      { title: "Hành động", filter: { genre: "Hành động" } },
      { title: "Phim bộ đang chiếu", filter: { airing: true } },
      { title: "AI & Robot", filter: { genre: "AI & Robot" } },
      { title: "Hậu tận thế", filter: { genre: "Hậu tận thế" } }
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
