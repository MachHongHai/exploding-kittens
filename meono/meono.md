# EXPLODING KITTENS - BASE GAME & BOT LOGIC (2D WEB GAME)

## 1. GAME OVERVIEW
- **Thể loại:** Turn-based Card Game (2-5 Players).
- **Mục tiêu:** Sống sót cuối cùng bằng cách không bốc phải lá `Exploding Kitten` (Mèo Nổ), hoặc có lá `Defuse` (Tháo ngòi) để gỡ bom.
- **Chế độ chơi (Game Modes):**
  - PvP: Chơi trực tuyến với người (Tạo phòng / Ghép ngẫu nhiên).
  - PvE: Chơi offline với Bot (4 cấp độ: Dễ, Trung bình, Khó, và Gemini AI).

---

## 2. CARD DATABASE (CƠ SỞ DỮ LIỆU BÀI & PHÂN BỔ CHUẨN)
Mỗi đối tượng bài (Card Object) gồm các thuộc tính: `id`, `type`, `name`, `description`.

| Loại bài (Type) | Action Type | Chức năng (Logic Code) |
| :--- | :--- | :--- |
| `EXPLODING_KITTEN` | Auto | Kích hoạt sự kiện Bị loại (Eliminate) nếu Player không có `Defuse`. |
| `DEFUSE` | Reaction | Hủy sự kiện Bị loại. Cho phép chèn lại `Exploding Kitten` vào `DrawPile` ở vị trí tùy chọn. |
| `ATTACK` | Action | Kết thúc lượt lập tức mà không cần rút bài. Buộc người chơi tiếp theo thực hiện 2 lượt liên tiếp. **Đặc biệt (Chained Attack):** Đánh đè Attack khi đang bị Attack sẽ cộng dồn số lượt còn lại + 2 sang cho người tiếp theo. |
| `SKIP` | Action | Kết thúc lượt lập tức mà không cần rút bài. Trừ số lượt phải đi (`turnsToPlay`) đi 1. |
| `FAVOR` | Action | Chọn 1 đối thủ. Đối thủ đó phải chọn và đưa 1 lá bài từ tay họ cho bạn. |
| `SHUFFLE` | Action | Xáo trộn ngẫu nhiên mảng `DrawPile`. |
| `SEE_THE_FUTURE` | Action | Cho phép xem trước 3 lá bài trên cùng của mấp rút `DrawPile`. |
| `NOPE` | Reaction | Hủy tác dụng của lá Action vừa đánh (ngoại trừ Exploding Kitten và Defuse). Người chơi không thể Nope lại chính lá Nope của mình. Hệ thống Nope đếm ngược cho phép delay 5 giây để đánh Nope. |
| `CAT_CARD` (5 loại) | Action | Các lá bài mèo thường. Đánh theo đôi (Pair) để trộm ngẫu nhiên 1 lá hoặc bộ 3 (Three of a kind) để đòi đích danh 1 lá. **Luật Combo:** Chỉ sử dụng Mèo thường cho Combo. Nghiêm cấm dùng bài Action (Skip, Attack...) làm nguyên liệu combo, ngoại trừ trường hợp "sắp chết" (không lối thoát). |

---

## 3. GAME SETUP ALGORITHM (THUẬT TOÁN KHỞI TẠO BỘ BÀI CHUẨN)
Để trò chơi cân bằng và đúng luật Mèo Nổ tiêu chuẩn, hệ thống tự động tối ưu hóa số lượng bài:

1. **Chia bài khởi đầu:** Mỗi người chơi nhận đúng **1 lá `DEFUSE`** và **7 lá bài thường** (tổng 8 lá/tay).
2. **Số lượng mìn:** Đưa vào bộ bài số lá bom đúng bằng `Số người chơi - 1`.
3. **Số lượng Defuse dư:** Ván 2-3 người (xáo 2 lá dư), Ván 4+ người (xáo toàn bộ lá dư).
4. **Phân bổ số lượng bài chức năng:**
   - **Ván 2-3 người:** Rút gọn bộ bài rút để đẩy nhanh nhịp độ (Đặc biệt ván 1v1 giới hạn 14 lá).
   - **Ván 4+ người:** Sử dụng toàn bộ 46 lá chức năng chuẩn.

---

## 4. DECK MEMORY SYSTEM (HỆ THỐNG GHI NHỚ ĐỈNH BÀI)
Trạng thái bộ nhớ `knownDeckTop` của từng người chơi:
* **See The Future:** Ghi nhớ 3 lá trên cùng.
* **Rút bài (Draw):** Dịch chuyển (`shift`) 1 phần tử đầu.
* **Xáo bài (Shuffle):** Xóa sạch `knownDeckTop` (`[]`).
* **Tháo ngòi (Defuse):** Ghi nhớ vị trí mìn cho người gài, xóa sạch bộ nhớ của những người khác.

---

## 5. PVE BOT LOGIC SYSTEM (HỆ THỐNG TRÍ TUỆ NHÂN TẠO PVE)

### Cấp độ 1: Dễ (EasyBot)
- 50% đánh, 50% rút. Gài bom ngẫu nhiên.

### Cấp độ 2: Trung bình (MediumBot)
- Né bom bằng Skip/Attack/Shuffle. Tiết kiệm bài nếu đỉnh an toàn. Gài bom thông minh cơ bản.

### Cấp độ 3: Khó (HardBot - Cao thủ)
Sử dụng thuật toán Rule-based cấp cao (chơi như cao thủ ngoài đời):
- **Chained Attack:** Biết phản đòn Attack để dồn số lượt cho đối thủ.
- **Defuse Placement:** Đặt bom thông minh (Nếu đối thủ không có Defuse → instant kill ở đỉnh; Nếu có Defuse → ép đối thủ dùng Defuse).
- **Phân chia Game State:** Chiến thuật thay đổi tùy theo Early game (giữ bài), Mid game (combo trộm bài), End game (tấn công tổng lực).
- **Ưu tiên thông tin:** Luôn dò đường bằng See The Future trước khi hành động liều lĩnh.

### Cấp độ 4: Gemini AI (Thực nghiệm)
- Tích hợp API Google Gemini để sinh nước đi dựa trên LLM prompt. Có cơ chế fallback về các phiên bản model nhỏ hơn hoặc MediumBot nếu API lỗi. Output chuẩn JSON.

---

## 6. ARCHITECTURE & UI/UX RULES (QUY TẮC KIẾN TRÚC & TRẢI NGHIỆM)

### 6.1. Responsive & Screen-fit Design
- Khóa toàn bộ cuộn trang (`overflow: hidden`). Giao diện 100% lấp đầy màn hình.
- Các icon người chơi phân bổ rộng, tạo không gian thoáng (`justify-evenly`).
- Bài trên tay (Hand) sử dụng hiệu ứng quạt 3D (fanned), show trọn vẹn ở viền dưới. Không dùng thanh cuộn ngang/dọc cho vùng chứa bài.

### 6.2. Non-blocking Overlays & Smooth Animations
- Mọi thao tác (đòi bài, chờ Nope) không che mất UI thao tác gốc.
- **Scroll of Acts (Lịch sử hành động):** Panel chi tiết hiển thị 10 hành động mới nhất, tích hợp Emoji, hiệu ứng chuyển màu và tự động cuộn chống trùng lặp. Đồ họa cuộn giấy (Scroll) sống động.
- **Card Animations:** Hiệu ứng Framer Motion khi đánh bài vào Discard Pile (bay từ trên, xoay góc ngẫu nhiên, phát sáng Glow) giúp dễ dàng theo dõi nhịp độ.
- **Cửa sổ đếm ngược (Action Window):** 5 giây chờ Nope cho phép thao tác nhịp nhàng, có delay thông minh cho Bot. Khắt khe trong việc tự động resolve.