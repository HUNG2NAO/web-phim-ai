/*
 * KHO PHIM TƯƠNG LAI (dùng cho các site có world: "tuong-lai" trong sites.js)
 * Cách điền giống films.js. Tranh vẽ tự động dùng các motif:
 *   "pho"   thành phố neon      "sao"   hành tinh, vũ trụ
 *   "luoi"  đường chân trời lưới "may"   người máy
 *   "hoang" hậu tận thế, sa mạc  "song"  sóng dữ liệu, hologram
 */
window.GENRES = window.GENRES || {};
window.GENRES["tuong-lai"] = [
  { name: "Viễn tưởng", char: "SF" },
  { name: "Cyberpunk", char: "CY" },
  { name: "Hành động", char: "AX" },
  { name: "Không gian", char: "SP" },
  { name: "AI & Robot", char: "AI" },
  { name: "Tâm lý", char: "PS" },
  { name: "Hậu tận thế", char: "PA" },
  { name: "Bí ẩn", char: "MY" }
];

(function (list) {
  list.forEach(function (f) { f.world = "tuong-lai"; window.FILMS.push(f); });
})([
  {
    id: "thanh-pho-khong-ngu", title: "Thành Phố Không Ngủ", year: 2026, type: "le",
    duration: "1g 38p", genres: ["Viễn tưởng", "Cyberpunk"], age: "T13", quality: "4K", views: 2620000,
    art: { motif: "pho", hue: 195 },
    synopsis: "Năm 2087, một thành phố ven biển không bao giờ tắt đèn. Khi điện lưới chập chờn đúng một đêm, cô kỹ sư trực ca phát hiện cả thành phố đang được vận hành bởi một ký ức chứ không phải cỗ máy."
  },
  {
    id: "sai-gon-2140", title: "Sài Gòn 2140", year: 2026, type: "bo", episodes: 10, aired: 4,
    duration: "48p/tập", genres: ["Cyberpunk", "Hành động"], age: "T16", quality: "4K", views: 2180000,
    art: { motif: "pho", hue: 330 },
    synopsis: "Thành phố nổi trên mặt nước sau khi biển dâng. Một shipper giao hàng bằng drone vô tình chở theo gói dữ liệu mà ba tập đoàn đều muốn có."
  },
  {
    id: "duong-dua-neon", title: "Đường Đua Neon", year: 2026, type: "le",
    duration: "1g 52p", genres: ["Hành động", "Cyberpunk"], age: "T16", quality: "4K", views: 1990000,
    art: { motif: "luoi", hue: 320 },
    synopsis: "Giải đua xe tự lái ngầm chạy xuyên khu phố cổ lúc nửa đêm. Một tay đua bị loại tìm cách quay lại bằng chiếc xe không có trí tuệ nhân tạo nào."
  },
  {
    id: "ma-nguon-linh-hon", title: "Mã Nguồn Linh Hồn", year: 2026, type: "bo", episodes: 8,
    duration: "45p/tập", genres: ["AI & Robot", "Tâm lý"], age: "T16", quality: "4K", views: 1760000,
    art: { motif: "may", hue: 185 },
    synopsis: "Một lập trình viên trẻ nhận nhiệm vụ sao lưu trí nhớ của người đã khuất. Bản sao thứ bảy bắt đầu nhớ những điều mà người thật chưa từng kể với ai."
  },
  {
    id: "sao-hoa-2099", title: "Sao Hỏa 2099", year: 2025, type: "le",
    duration: "2g 04p", genres: ["Không gian", "Viễn tưởng"], age: "T13", quality: "4K", views: 1540000,
    art: { motif: "sao", hue: 15 },
    synopsis: "Chuyến tàu chở người Việt đầu tiên hạ cánh xuống Sao Hỏa. Thứ họ tìm thấy dưới lớp bụi đỏ là một bàn thờ nhỏ còn nguyên nén nhang."
  },
  {
    id: "tin-hieu-47", title: "Tín Hiệu 47", year: 2026, type: "bo", episodes: 6,
    duration: "50p/tập", genres: ["Bí ẩn", "Không gian"], age: "T16", quality: "4K", views: 1320000,
    art: { motif: "song", hue: 170 },
    synopsis: "Trạm quan sát trên Mặt Trăng bắt được một tín hiệu lặp lại mỗi 47 phút. Nó đang đếm ngược."
  },
  {
    id: "nguoi-may-gac-dem", title: "Người Máy Gác Đêm", year: 2025, type: "le",
    duration: "1g 41p", genres: ["AI & Robot", "Tâm lý"], age: "P", quality: "4K", views: 1100000,
    art: { motif: "may", hue: 35 },
    synopsis: "Người máy gác đêm của một bệnh viện bỏ hoang vẫn đi tuần đúng giờ suốt hai mươi năm, chờ một bệnh nhân đã hẹn sẽ quay lại."
  },
  {
    id: "cat-do", title: "Cát Đỏ", year: 2026, type: "le",
    duration: "1g 56p", genres: ["Hậu tận thế", "Hành động"], age: "T18", quality: "4K", views: 1480000,
    art: { motif: "hoang", hue: 18 },
    synopsis: "Sau cơn bão cát kéo dài ba năm, đoàn xe cuối cùng băng qua sa mạc từng là đồng bằng sông Cửu Long để tìm nguồn nước sạch."
  },
  {
    id: "tram-cuoi-vanh-dai", title: "Trạm Cuối Vành Đai", year: 2025, type: "bo", episodes: 12,
    duration: "42p/tập", genres: ["Không gian", "Tâm lý"], age: "T13", quality: "4K", views: 960000,
    art: { motif: "sao", hue: 220 },
    synopsis: "Năm người làm việc ở trạm khai thác xa nhất vành đai tiểu hành tinh. Chuyến tàu tiếp tế tiếp theo sẽ đến sau 400 ngày."
  },
  {
    id: "ban-sao-thu-bay", title: "Bản Sao Thứ Bảy", year: 2026, type: "ngan",
    duration: "16p", genres: ["Tâm lý", "AI & Robot"], age: "T13", quality: "4K", views: 720000,
    art: { motif: "song", hue: 280 },
    synopsis: "Mười sáu phút đối thoại giữa một người phụ nữ và phiên bản AI của chính cô ở tuổi bảy mươi."
  },
  {
    id: "mua-axit", title: "Mưa Axit", year: 2026, type: "ngan",
    duration: "20p", genres: ["Cyberpunk", "Bí ẩn"], age: "T16", quality: "4K", views: 840000,
    art: { motif: "pho", hue: 140 },
    synopsis: "Đêm mưa axit, thám tử tư nhận vụ tìm một con mèo. Con mèo có quyền truy cập cấp cao nhất của thành phố."
  },
  {
    id: "the-he-sau-cung", title: "Thế Hệ Sau Cùng", year: 2026, type: "bo", episodes: 16, aired: 11,
    duration: "45p/tập", genres: ["Hậu tận thế", "Tâm lý"], age: "T16", quality: "4K", views: 1690000,
    art: { motif: "hoang", hue: 32 },
    synopsis: "Những đứa trẻ sinh ra trong hầm trú ẩn lần đầu lên mặt đất. Không ai trong chúng từng thấy bầu trời."
  },
  {
    id: "luoi-anh-sang", title: "Lưới Ánh Sáng", year: 2025, type: "le",
    duration: "1g 47p", genres: ["Hành động", "Viễn tưởng"], age: "T13", quality: "4K", views: 910000,
    art: { motif: "luoi", hue: 190 },
    synopsis: "Một game thủ bị kẹt trong trò chơi thực tế ảo mà chính cậu thiết kế. Lối ra duy nhất là thắng phiên bản giỏi nhất của mình."
  },
  {
    id: "robot-ban-kem", title: "Chú Robot Bán Kem", year: 2026, type: "ngan",
    duration: "12p", genres: ["AI & Robot", "Viễn tưởng"], age: "P", quality: "HD", views: 650000,
    art: { motif: "may", hue: 300 },
    synopsis: "Một chú robot cũ đẩy xe kem qua những con phố mùa hè năm 2090, cố nhớ món kem mà cô bé đầu tiên từng mua của mình."
  },
  {
    id: "quy-dao-trai-tim", title: "Quỹ Đạo Trái Tim", year: 2026, type: "le",
    duration: "1g 49p", genres: ["Không gian", "Tâm lý"], age: "T13", quality: "4K", views: 1210000,
    art: { motif: "sao", hue: 260 },
    synopsis: "Hai phi hành gia ở hai trạm vũ trụ chỉ nhìn thấy nhau 9 phút mỗi lần quỹ đạo giao nhau."
  },
  {
    id: "ky-uc-thue", title: "Ký Ức Thuê", year: 2025, type: "bo", episodes: 8,
    duration: "45p/tập", genres: ["Cyberpunk", "Tâm lý"], age: "T16", quality: "4K", views: 1050000,
    art: { motif: "song", hue: 200 },
    synopsis: "Ở thành phố nơi ký ức có thể cho thuê theo giờ, một cô gái nghèo cho thuê tuổi thơ của mình và không lấy lại được."
  }
]);
