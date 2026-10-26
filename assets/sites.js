/*
 * CẤU HÌNH 5 THƯƠNG HIỆU
 * Cả 5 tên miền dùng chung một mã nguồn. Trang tự nhận tên miền đang mở
 * và lấy đúng tên, màu nhấn, khẩu hiệu, phim nổi bật và các hàng phim bên dưới.
 *
 * rows[].filter có thể là:
 *   { trending: true }        – phim đánh dấu thịnh hành
 *   { newest: true }          – sắp theo năm mới nhất
 *   { type: "le" | "bo" | "ngan" }
 *   { genre: "Kinh dị" }      – theo thể loại (viết đúng như trong films.js)
 */
window.SITES = [
  {
    id: "xuongphim",
    domain: "xuongphim.ai",
    name: "Xưởng Phim",
    tagline: "Nơi phim AI được sản xuất mỗi ngày",
    accent: "#F5A524",
    onAccent: "#1A1203",
    featured: "thanh-pho-khong-ngu",
    rows: [
      { title: "Vừa ra lò", filter: { newest: true } },
      { title: "Đang thịnh hành", filter: { trending: true } },
      { title: "Khoa học viễn tưởng", filter: { genre: "Viễn tưởng" } },
      { title: "Phim ngắn AI", filter: { type: "ngan" } }
    ]
  },
  {
    id: "khophim",
    domain: "khophim.ai",
    name: "Kho Phim",
    tagline: "Thư viện phim AI, tìm là có",
    accent: "#2EC4B6",
    onAccent: "#04201D",
    featured: "ma-nguon-linh-hon",
    rows: [
      { title: "Phim bộ trọn bộ", filter: { type: "bo" } },
      { title: "Phim lẻ", filter: { type: "le" } },
      { title: "Hoạt hình", filter: { genre: "Hoạt hình" } },
      { title: "Mới cập nhật", filter: { newest: true } }
    ]
  },
  {
    id: "phephim",
    domain: "phephim.ai",
    name: "Phê Phim",
    tagline: "Phim AI xem một lần là nhớ",
    accent: "#FF5C8A",
    onAccent: "#2A0612",
    featured: "duong-dua-neon",
    rows: [
      { title: "Đang hot", filter: { trending: true } },
      { title: "Hành động", filter: { genre: "Hành động" } },
      { title: "Tình cảm", filter: { genre: "Tình cảm" } },
      { title: "Phim ngắn xem nhanh", filter: { type: "ngan" } }
    ]
  },
  {
    id: "phimhay",
    domain: "phimhay.ai",
    name: "Phim Hay",
    tagline: "Tuyển chọn phim AI đáng xem nhất",
    accent: "#F0503C",
    onAccent: "#260803",
    featured: "nguoi-gac-hai-dang",
    rows: [
      { title: "Tuyển chọn tuần này", filter: { trending: true } },
      { title: "Tâm lý", filter: { genre: "Tâm lý" } },
      { title: "Bí ẩn", filter: { genre: "Bí ẩn" } },
      { title: "Phim lẻ", filter: { type: "le" } }
    ]
  },
  {
    id: "ghienphim",
    domain: "ghienphim.ai",
    name: "Ghiền Phim",
    tagline: "Phim AI cày hoài không chán",
    accent: "#9D8CFF",
    onAccent: "#120A33",
    featured: "meo-mun-tham-tu",
    rows: [
      { title: "Cày một mạch", filter: { type: "bo" } },
      { title: "Phim ngắn AI", filter: { type: "ngan" } },
      { title: "Kinh dị", filter: { genre: "Kinh dị" } },
      { title: "Đang thịnh hành", filter: { trending: true } }
    ]
  }
];
