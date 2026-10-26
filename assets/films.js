/*
 * DANH SÁCH PHIM (dùng chung cho cả 5 website)
 * Đây là phim MẪU để xem giao diện. Thay bằng phim của bạn:
 *   id        – mã không dấu, không trùng
 *   type      – "le" (phim lẻ), "bo" (phim bộ), "ngan" (phim ngắn)
 *   episodes  – số tập (chỉ cho phim bộ)
 *   hue       – 2 số từ 0–360, tạo màu poster khi chưa có ảnh
 *   poster    – (tuỳ chọn) đường dẫn ảnh poster, ví dụ "posters/abc.jpg"
 *   video     – (tuỳ chọn) đường dẫn file .mp4 hoặc link video của bạn
 *   sites     – (tuỳ chọn) chỉ hiện trên các site này, ví dụ ["khophim","phimhay"]
 */
window.FILMS = [
  {
    id: "thanh-pho-khong-ngu", title: "Thành Phố Không Ngủ", year: 2026, type: "le",
    duration: "1g 38p", genres: ["Viễn tưởng", "Bí ẩn"], age: "T13", quality: "4K", ratio: "2.39:1",
    trending: true, hue: [28, 200],
    synopsis: "Năm 2087, một thành phố ven biển không bao giờ tắt đèn. Khi điện lưới chập chờn đúng một đêm, cô kỹ sư trực ca phát hiện cả thành phố đang được vận hành bởi một ký ức chứ không phải cỗ máy."
  },
  {
    id: "ma-nguon-linh-hon", title: "Mã Nguồn Linh Hồn", year: 2026, type: "bo", episodes: 8,
    duration: "8 tập · 45p/tập", genres: ["Viễn tưởng", "Tâm lý"], age: "T16", quality: "4K", ratio: "2.39:1",
    trending: true, hue: [180, 260],
    synopsis: "Một lập trình viên trẻ nhận nhiệm vụ sao lưu trí nhớ của người đã khuất. Bản sao thứ bảy bắt đầu nhớ những điều mà người thật chưa từng kể với ai."
  },
  {
    id: "duong-dua-neon", title: "Đường Đua Neon", year: 2026, type: "le",
    duration: "1g 52p", genres: ["Hành động", "Viễn tưởng"], age: "T16", quality: "4K", ratio: "2.39:1",
    trending: true, hue: [330, 190],
    synopsis: "Giải đua xe tự lái ngầm chạy xuyên khu phố cổ lúc nửa đêm. Một tay đua bị loại tìm cách quay lại bằng chiếc xe không có trí tuệ nhân tạo nào."
  },
  {
    id: "nguoi-gac-hai-dang", title: "Người Gác Hải Đăng Cuối Cùng", year: 2025, type: "le",
    duration: "1g 41p", genres: ["Tâm lý", "Gia đình"], age: "P", quality: "4K", ratio: "1.85:1",
    trending: true, hue: [205, 40],
    synopsis: "Ngọn hải đăng sắp được tự động hoá. Người gác cuối cùng có ba mươi ngày để dạy cỗ máy thay thế anh hiểu vì sao ánh đèn phải bật sớm hơn giờ quy định."
  },
  {
    id: "meo-mun-tham-tu", title: "Mèo Mun Thám Tử", year: 2026, type: "bo", episodes: 12,
    duration: "12 tập · 22p/tập", genres: ["Hoạt hình", "Bí ẩn"], age: "P", quality: "HD", ratio: "16:9",
    trending: true, hue: [265, 45],
    synopsis: "Mỗi tập một vụ án nhỏ trong khu chung cư: chiếc dép biến mất, bình hoa bị đổ, và một bí ẩn lớn dần qua từng tập về người hàng xóm tầng thượng."
  },
  {
    id: "dem-trang-lang-gom", title: "Đêm Rằm Ở Làng Gốm", year: 2025, type: "le",
    duration: "1g 29p", genres: ["Kinh dị", "Bí ẩn"], age: "T18", quality: "4K", ratio: "2.39:1",
    hue: [12, 300],
    synopsis: "Lò gốm trăm năm chỉ đỏ lửa vào đêm rằm. Nhóm sinh viên về làng làm phim tốt nghiệp và nhận ra trong mỗi chiếc bình đều có tiếng người gọi."
  },
  {
    id: "robot-ban-kem", title: "Chú Robot Bán Kem", year: 2026, type: "ngan",
    duration: "12p", genres: ["Hoạt hình", "Gia đình"], age: "P", quality: "HD", ratio: "16:9",
    hue: [190, 330],
    synopsis: "Một chú robot cũ đẩy xe kem qua những con phố mùa hè, cố nhớ món kem mà cô bé đầu tiên từng mua của mình."
  },
  {
    id: "sao-hoa-2099", title: "Sao Hỏa 2099", year: 2025, type: "le",
    duration: "2g 04p", genres: ["Viễn tưởng", "Phiêu lưu"], age: "T13", quality: "4K", ratio: "2.39:1",
    hue: [15, 35],
    synopsis: "Chuyến tàu chở người Việt đầu tiên hạ cánh xuống Sao Hỏa. Thứ họ tìm thấy dưới lớp bụi đỏ là một bàn thờ nhỏ còn nguyên nén nhang."
  },
  {
    id: "vo-su-may-trang", title: "Võ Sư Mây Trắng", year: 2026, type: "bo", episodes: 10,
    duration: "10 tập · 40p/tập", genres: ["Hành động", "Phiêu lưu"], age: "T13", quality: "4K", ratio: "2.39:1",
    trending: true, hue: [210, 0],
    synopsis: "Một võ đường trên núi nhận người học trò kỳ lạ: biết mọi thế võ trên đời nhưng chưa từng đánh thắng ai."
  },
  {
    id: "can-phong-so-7", title: "Căn Phòng Số 7", year: 2026, type: "ngan",
    duration: "18p", genres: ["Kinh dị"], age: "T16", quality: "4K", ratio: "1.85:1",
    hue: [350, 160],
    synopsis: "Khách sạn chỉ có sáu phòng. Mỗi đêm, người lễ tân vẫn nhận một cuộc gọi đặt phòng số 7."
  },
  {
    id: "la-thu-tu-tuong-lai", title: "Lá Thư Từ Tương Lai", year: 2025, type: "le",
    duration: "1g 47p", genres: ["Tình cảm", "Viễn tưởng"], age: "T13", quality: "4K", ratio: "1.85:1",
    hue: [340, 30],
    synopsis: "Cô giáo dạy văn nhận được những lá thư viết tay đề ngày mười năm sau, ký tên một người cô chưa từng gặp."
  },
  {
    id: "khu-vuon-cua-ba", title: "Khu Vườn Của Bà", year: 2026, type: "ngan",
    duration: "9p", genres: ["Gia đình", "Hoạt hình"], age: "P", quality: "HD", ratio: "16:9",
    hue: [110, 50],
    synopsis: "Cậu bé thành phố về quê nghỉ hè và học cách tưới một khu vườn biết lắng nghe."
  },
  {
    id: "tin-hieu-day-bien", title: "Tín Hiệu Từ Đáy Biển", year: 2026, type: "bo", episodes: 6,
    duration: "6 tập · 50p/tập", genres: ["Bí ẩn", "Viễn tưởng"], age: "T16", quality: "4K", ratio: "2.39:1",
    hue: [195, 230],
    synopsis: "Trạm nghiên cứu ngoài khơi bắt được một tín hiệu lặp lại mỗi 47 phút. Nó đang đếm ngược."
  },
  {
    id: "anh-den-san-khau", title: "Ánh Đèn Sân Khấu", year: 2025, type: "le",
    duration: "1g 55p", genres: ["Âm nhạc", "Tình cảm"], age: "P", quality: "4K", ratio: "1.85:1",
    hue: [45, 320],
    synopsis: "Ban nhạc phòng trà sắp giải tán có một đêm diễn cuối, và một ca sĩ ảo được thuê để hát thay người đã rời đi."
  },
  {
    id: "hat-cat-phieu-luu", title: "Hành Trình Hạt Cát", year: 2026, type: "ngan",
    duration: "14p", genres: ["Hoạt hình", "Phiêu lưu"], age: "P", quality: "4K", ratio: "16:9",
    hue: [38, 190],
    synopsis: "Một hạt cát bị gió cuốn từ sa mạc ra biển, đi qua bốn mùa và mười nghìn cây số."
  },
  {
    id: "nha-tro-tang-3", title: "Nhà Trọ Tầng 3", year: 2026, type: "bo", episodes: 16,
    duration: "16 tập · 30p/tập", genres: ["Tình cảm", "Gia đình"], age: "T13", quality: "HD", ratio: "16:9",
    hue: [20, 260],
    synopsis: "Năm người thuê trọ chung một tầng, chung một cái bếp và chung một chủ nhà có thói quen kể chuyện lúc nửa đêm."
  }
];
