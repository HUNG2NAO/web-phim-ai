/*
 * KHO PHIM (dùng chung cho cả 5 website)
 * Đây là phim MẪU để xem giao diện. Thay bằng phim AI của bạn.
 *
 *   id        – mã không dấu, không trùng
 *   type      – "bo" (phim bộ), "le" (phim lẻ), "ngan" (phim ngắn)
 *   episodes  – tổng số tập (phim bộ); aired – số tập đã ra (bỏ trống nếu đã đủ)
 *   genres    – lấy trong danh sách GENRES bên dưới
 *   views     – lượt xem (dùng để xếp hạng)
 *   art       – tranh vẽ tự động khi chưa có poster:
 *                 motif: "tien" (núi tiên lơ lửng), "truc" (rừng trúc, kiếm khách),
 *                        "kiem" (vết chém mực đỏ), "dinh" (đình bên hồ),
 *                        "cung" (mái cung điện), "den" (đèn lồng)
 *                 paper: true = nền giấy dó sáng, false = nền mực tối
 *                 hue:   màu trời (0–360)
 *   poster    – (tuỳ chọn) ảnh poster thật, ví dụ "posters/abc.jpg"
 *   video     – (tuỳ chọn) link video .mp4 hoặc link phát của bạn
 *   sites     – (tuỳ chọn) chỉ hiện trên một số site, ví dụ ["khophim","phimhay"]
 */
window.GENRES = window.GENRES || {};
window.GENRES["co-trang"] = [
  { name: "Hành động", char: "武" },
  { name: "Tu tiên", char: "仙" },
  { name: "Kiếm hiệp", char: "侠" },
  { name: "Tâm lý", char: "心" },
  { name: "Cung đấu", char: "宫" },
  { name: "Huyền huyễn", char: "幻" },
  { name: "Lịch sử", char: "史" },
  { name: "Tình cảm", char: "情" }
];

window.FILMS = [
  {
    id: "van-co-tien-do", title: "Vạn Cổ Tiên Đồ", year: 2026, type: "bo", episodes: 40, aired: 18,
    duration: "45p/tập", genres: ["Tu tiên", "Huyền huyễn"], age: "T13", quality: "4K", views: 2840000,
    art: { motif: "tien", paper: false, hue: 205 },
    synopsis: "Thiếu niên gánh củi dưới chân núi nhặt được một mảnh ngọc vỡ. Mảnh ngọc ấy là chìa khoá duy nhất mở lại con đường lên tiên giới đã đóng suốt vạn năm."
  },
  {
    id: "kiem-khach-vo-danh", title: "Kiếm Khách Vô Danh", year: 2026, type: "le",
    duration: "1g 52p", genres: ["Kiếm hiệp", "Hành động"], age: "T16", quality: "4K", views: 1960000,
    art: { motif: "truc", paper: true, hue: 30 },
    synopsis: "Một kiếm khách không tên đi qua mười hai trấn để trả lại mười hai thanh kiếm cho những người đã chết. Thanh cuối cùng thuộc về chính hắn."
  },
  {
    id: "phuong-te-cung", title: "Phượng Tê Cung", year: 2026, type: "bo", episodes: 36,
    duration: "45p/tập", genres: ["Cung đấu", "Tâm lý"], age: "T13", quality: "4K", views: 2310000,
    art: { motif: "cung", paper: false, hue: 350 },
    synopsis: "Cung nữ giữ đèn ở cung Phượng Tê thuộc lòng tiếng bước chân của từng phi tần. Một đêm, có tiếng bước chân lạ đi vào nơi không ai được phép vào."
  },
  {
    id: "huyet-nguyet-thanh", title: "Huyết Nguyệt Thành", year: 2025, type: "le",
    duration: "2g 06p", genres: ["Hành động", "Lịch sử"], age: "T18", quality: "4K", views: 1520000,
    art: { motif: "kiem", paper: false, hue: 8 },
    synopsis: "Toà thành biên ải bị vây bảy ngày dưới trăng máu. Ba trăm binh sĩ, một vị tướng trẻ và lời hứa giữ cổng thành đến giọt máu cuối cùng."
  },
  {
    id: "tam-ma", title: "Tâm Ma", year: 2026, type: "le",
    duration: "1g 44p", genres: ["Tâm lý", "Huyền huyễn"], age: "T16", quality: "4K", views: 1180000,
    art: { motif: "dinh", paper: true, hue: 200 },
    synopsis: "Vị đại sư tu thiền trên đảo giữa hồ bắt đầu nhìn thấy bóng mình dưới nước cử động trước khi mình kịp cử động."
  },
  {
    id: "dao-tam-bat-diet", title: "Đạo Tâm Bất Diệt", year: 2026, type: "bo", episodes: 30,
    duration: "40p/tập", genres: ["Tu tiên", "Hành động"], age: "T13", quality: "4K", views: 1740000,
    art: { motif: "tien", paper: false, hue: 265 },
    synopsis: "Bị phế toàn bộ tu vi trong ngày đại điển, đệ tử chân truyền bắt đầu tu lại từ đầu bằng một tâm pháp mà cả tông môn coi là tà đạo."
  },
  {
    id: "thien-son-mo-tuyet", title: "Thiên Sơn Mộ Tuyết", year: 2025, type: "bo", episodes: 24,
    duration: "45p/tập", genres: ["Kiếm hiệp", "Tình cảm"], age: "T13", quality: "4K", views: 1390000,
    art: { motif: "truc", paper: false, hue: 215 },
    synopsis: "Hai đệ tử của hai phái kiếm thù địch hẹn gặp nhau mỗi mùa tuyết đầu tiên trên đỉnh Thiên Sơn, cho đến năm tuyết rơi màu đỏ."
  },
  {
    id: "bach-dang-giang", title: "Bạch Đằng Giang", year: 2026, type: "le",
    duration: "2g 14p", genres: ["Lịch sử", "Hành động"], age: "T13", quality: "4K", views: 2050000,
    art: { motif: "kiem", paper: true, hue: 25 },
    synopsis: "Những cọc gỗ cắm dưới lòng sông, một con nước triều và một đêm chờ đợi quyết định vận mệnh của cả một dân tộc."
  },
  {
    id: "truc-lam-song-kiem", title: "Trúc Lâm Song Kiếm", year: 2025, type: "le",
    duration: "1g 38p", genres: ["Kiếm hiệp"], age: "T13", quality: "4K", views: 880000,
    art: { motif: "truc", paper: true, hue: 110 },
    synopsis: "Hai anh em sinh đôi học hai nửa của một bộ kiếm pháp. Chỉ khi đứng cạnh nhau, bộ kiếm pháp mới trọn vẹn."
  },
  {
    id: "ho-ly-nui-tuyet", title: "Hồ Ly Núi Tuyết", year: 2026, type: "bo", episodes: 20, aired: 9,
    duration: "40p/tập", genres: ["Huyền huyễn", "Tình cảm"], age: "T13", quality: "4K", views: 1610000,
    art: { motif: "den", paper: false, hue: 330 },
    synopsis: "Hồ ly chín đuôi cuối cùng hoá thành người để trả ơn một thầy thuốc nghèo, nhưng mỗi ngày làm người, nàng quên đi một ký ức của mình."
  },
  {
    id: "cuu-thien-loi-kiep", title: "Cửu Thiên Lôi Kiếp", year: 2026, type: "ngan",
    duration: "15p", genres: ["Tu tiên"], age: "P", quality: "4K", views: 640000,
    art: { motif: "tien", paper: false, hue: 230 },
    synopsis: "Mười lăm phút một người đứng dưới chín tầng sấm sét để vượt kiếp hoá thần."
  },
  {
    id: "lac-hoa-dinh", title: "Lạc Hoa Đình", year: 2025, type: "bo", episodes: 12,
    duration: "35p/tập", genres: ["Tâm lý", "Tình cảm"], age: "T13", quality: "HD", views: 720000,
    art: { motif: "dinh", paper: false, hue: 320 },
    synopsis: "Đình hoa rụng bên hồ là nơi một nữ thi sĩ viết thư cho người chồng đi lính. Mười hai lá thư, mười hai mùa hoa."
  },
  {
    id: "sat-thu-den-long", title: "Sát Thủ Đèn Lồng", year: 2026, type: "ngan",
    duration: "18p", genres: ["Hành động", "Huyền huyễn"], age: "T16", quality: "4K", views: 930000,
    art: { motif: "den", paper: false, hue: 12 },
    synopsis: "Đêm hội hoa đăng, mỗi chiếc đèn lồng tắt là một mạng người. Người bán đèn biết trước chiếc nào sẽ tắt."
  },
  {
    id: "mong-hoi-duong-trieu", title: "Mộng Hồi Đường Triều", year: 2026, type: "bo", episodes: 28, aired: 22,
    duration: "45p/tập", genres: ["Tình cảm", "Cung đấu"], age: "T13", quality: "4K", views: 1870000,
    art: { motif: "cung", paper: true, hue: 40 },
    synopsis: "Cô thợ phục chế tranh cổ ngủ quên trong bảo tàng và tỉnh dậy giữa kinh thành Trường An, đúng đêm trước một cuộc chính biến."
  },
  {
    id: "kiem-y-co-thanh", title: "Kiếm Ý Cô Thành", year: 2025, type: "le",
    duration: "1g 47p", genres: ["Kiếm hiệp", "Tâm lý"], age: "T16", quality: "4K", views: 810000,
    art: { motif: "kiem", paper: false, hue: 190 },
    synopsis: "Lão kiếm sư mù sống một mình trong toà thành bỏ hoang, ngày ngày luyện một chiêu kiếm chưa ai từng thấy."
  },
  {
    id: "linh-son-dao-si", title: "Linh Sơn Đạo Sĩ", year: 2025, type: "le",
    duration: "1g 35p", genres: ["Tu tiên", "Huyền huyễn"], age: "P", quality: "4K", views: 690000,
    art: { motif: "tien", paper: true, hue: 160 },
    synopsis: "Đạo sĩ trẻ trên Linh Sơn chỉ có một đệ tử: con khỉ trộm đào của sư phụ năm xưa."
  },
  {
    id: "that-hiep-giang-nam", title: "Thất Hiệp Giang Nam", year: 2026, type: "bo", episodes: 16,
    duration: "45p/tập", genres: ["Kiếm hiệp", "Hành động"], age: "T13", quality: "4K", views: 1450000,
    art: { motif: "truc", paper: false, hue: 140 },
    synopsis: "Bảy người lạ, bảy món nợ cũ và một chuyến hộ tiêu xuyên Giang Nam mà không ai muốn nhận."
  },
  {
    id: "an-ngoc-truyen-quoc", title: "Ấn Ngọc Truyền Quốc", year: 2025, type: "bo", episodes: 20,
    duration: "45p/tập", genres: ["Lịch sử", "Tâm lý"], age: "T13", quality: "4K", views: 990000,
    art: { motif: "cung", paper: false, hue: 45 },
    synopsis: "Ngọc tỷ truyền quốc biến mất trong đêm tân vương đăng cơ. Vị quan nhỏ giữ kho có ba ngày để tìm ra nó."
  },
  {
    id: "chen-tra-lac-duong", title: "Một Chén Trà Ở Lạc Dương", year: 2026, type: "ngan",
    duration: "22p", genres: ["Tâm lý"], age: "P", quality: "HD", views: 410000,
    art: { motif: "dinh", paper: true, hue: 90 },
    synopsis: "Hai người bạn cũ gặp lại ở quán trà ven đường, nói chuyện trời mưa, và không ai nhắc đến chuyện năm xưa."
  },
  {
    id: "nu-tuong-me-linh", title: "Nữ Tướng Mê Linh", year: 2026, type: "le",
    duration: "2g 01p", genres: ["Lịch sử", "Hành động"], age: "T13", quality: "4K", views: 1330000,
    art: { motif: "kiem", paper: false, hue: 30 },
    synopsis: "Từ đất Mê Linh, hai chị em gái dựng cờ khởi nghĩa, đánh đuổi quân xâm lược và giành lại sáu mươi lăm thành trì."
  }
];
