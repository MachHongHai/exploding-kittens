# EXPLODING KITTENS - BASE GAME & BOT LOGIC (2D WEB GAME)

## 1. GAME OVERVIEW
- **Thể loại:** Turn-based Card Game (2-5 Players).
- **Mục tiêu:** Sống sót cuối cùng bằng cách không bốc phải lá `Exploding Kitten` (Mèo Nổ), hoặc có lá `Defuse` (Tháo ngòi) để gỡ bom.
- **Chế độ chơi (Game Modes):**
  - PvP: Chơi trực tuyến với người (Tạo phòng / Ghép ngẫu nhiên).
  - PvE: Chơi offline với Bot (3 cấp độ: Dễ, Trung bình, Khó).

---

## 2. CARD DATABASE (CƠ SỞ DỮ LIỆU BÀI & PHÂN BỔ CHUẨN)
Mỗi đối tượng bài (Card Object) gồm các thuộc tính: `id`, `type`, `name`, `description`.

| Loại bài (Type) | Action Type | Chức năng (Logic Code) |
| :--- | :--- | :--- |
| `EXPLODING_KITTEN` | Auto | Kích hoạt sự kiện Bị loại (Eliminate) nếu Player không có `Defuse`. |
| `DEFUSE` | Reaction | Hủy sự kiện Bị loại. Cho phép chèn lại `Exploding Kitten` vào `DrawPile` ở vị trí tùy chọn. |
| `ATTACK` | Action | Kết thúc lượt lập tức mà không cần rút bài. Buộc người chơi tiếp theo thực hiện 2 lượt liên tiếp (cộng dồn lượt nếu đánh đè Attack). |
| `SKIP` | Action | Kết thúc lượt lập tức mà không cần rút bài. Trừ số lượt phải đi (`turnsToPlay`) đi 1. |
| `FAVOR` | Action | Chọn 1 đối thủ. Đối thủ đó phải chọn và đưa 1 lá bài từ tay họ cho bạn. |
| `SHUFFLE` | Action | Xáo trộn ngẫu nhiên mảng `DrawPile`. |
| `SEE_THE_FUTURE` | Action | Cho phép xem trước 3 lá bài trên cùng của mấp rút `DrawPile`. |
| `NOPE` | Reaction | Hủy tác dụng của lá Action vừa đánh (ngoại trừ Exploding Kitten và Defuse). Người chơi không thể Nope lại chính lá Nope của mình. |
| `CAT_CARD` (5 loại) | Action | Các lá bài mèo thường (Tacocat, Cattermelon, Hairy Potato, Beard Cat, Rainbow-Ralphing). Đánh theo đôi (Pair) để trộm ngẫu nhiên 1 lá từ tay đối thủ. |

---

## 3. GAME SETUP ALGORITHM (THUẬT TOÁN KHỞI TẠO BỘ BÀI CHUẨN)
Để trò chơi cân bằng và đúng luật Mèo Nổ tiêu chuẩn, hệ thống tự động tối ưu hóa số lượng bài dựa trên số lượng người chơi:

1. **Chia bài khởi đầu:**
   - Mỗi người chơi (bao gồm cả Bot) nhận đúng **1 lá `DEFUSE`**.
   - Phát thêm **7 lá bài thường** từ xấp bài đã trộn. (Mỗi người chơi bắt đầu ván đấu với **8 lá bài trên tay**).
2. **Số lượng mìn (Exploding Kittens):**
   - Đưa vào bộ bài số lá bom đúng bằng `Số người chơi - 1`.
3. **Số lượng Defuse dư xáo lại vào bộ bài rút:**
   - **Với ván 2-3 người chơi:** Chỉ xáo **đúng 2 lá `DEFUSE` còn dư** vào bộ bài rút.
   - **Với ván từ 4 người chơi trở lên:** Xáo **toàn bộ số lá `DEFUSE` còn dư** vào bộ bài rút.
4. **Phân bổ số lượng bài chức năng (theo cơ chế Paw Print của Party Pack):**
   - **Nếu ván đấu chỉ có 2-3 người chơi:** Hệ thống rút gọn bộ bài rút để đẩy nhanh nhịp độ (Attack: 2, Skip: 4, Favor: 2, Shuffle: 2, See The Future: 3, Nope: 4, các loại Mèo thường: 3 lá/loại).
     *Đặc biệt: Chế độ 1v1 (2 người chơi) giới hạn `DrawPile` chỉ còn đúng 14 lá (1 Bom, 2 Defuse, 11 chức năng ngẫu nhiên) để đẩy nhanh tốc độ trận đấu.*
   - **Nếu ván đấu có từ 4 người chơi trở lên:** Sử dụng toàn bộ 46 lá chức năng chuẩn của bộ bài.

---

## 4. DECK MEMORY SYSTEM (HỆ THỐNG GHI NHỚ ĐỈNH BÀI)
Hệ thống lưu trữ trạng thái bộ nhớ `knownDeckTop` cho mỗi người chơi:
* **See The Future:** Ghi nhớ 3 lá trên cùng.
* **Rút bài (Draw):** Dịch chuyển (`shift`) bớt 1 phần tử đầu tiên.
* **Xáo bài (Shuffle):** Xóa sạch `knownDeckTop` của tất cả người chơi (`[]`).
* **Tháo ngòi (Defuse):** Người gài bom chèn `EXPLODING_KITTEN` vào `knownDeckTop` tại đúng vị trí gài. Các người chơi khác bị xóa sạch bộ nhớ `knownDeckTop`.

---

## 5. PVE BOT LOGIC SYSTEM (HỆ THỐNG TRÍ TUỆ NHÂN TẠO PVE)

### Cấp độ 1: Dễ (EasyBot)
- Lựa chọn hành động ngẫu nhiên (50% đánh, 50% rút). Gài bom ngẫu nhiên.

### Cấp độ 2: Trung bình (MediumBot)
Sử dụng Rule-based kết hợp với `knownDeckTop`:
* **Né bom:** Đánh lá phòng thủ (`Skip`, `Attack`, `Shuffle`) nếu biết lá bài tiếp theo là Bom.
* **Tiết kiệm bài:** Không đánh lá phòng thủ/chức năng khi biết chắc đỉnh bài an toàn, sẽ chủ động rút bài.
* **Gài bom thông minh:** Đặt bom sát ván (index 0) nếu người tiếp theo không có `Defuse`, đặt sâu hơn nếu họ có `Defuse` để câu giờ.

### Cấp độ 3: Khó (AIBot) - API Google Gemini
- **Tích hợp:** Dùng `fetch` gọi API trực tiếp đến Google Gemini, bảo mật API Key qua `.env` và HTTP Header.
- **Dự phòng (Fallback):** Xoay vòng từ `gemini-2.5-flash-lite` -> `gemini-3.5-flash` -> `gemini-2.5-flash`. Fallback về MediumBot nếu toàn bộ API thất bại.
- **Tối ưu Quota:** Nếu không có nguy hiểm và không có bài nào chơi được, tự động `DRAW_CARD` không cần gọi API.
- **Structured JSON Output:** Đảm bảo Gemini luôn trả về định dạng JSON khắt khe theo schema định sẵn (action, cardIds, targetId, insertIndex, requestedCardType, reasoning).

---

## 6. ARCHITECTURE & DESIGN RULES (QUY TẮC KIẾN TRÚC & UI/UX HIỆN TẠI)

### 6.1. Responsive & Screen-fit Design (Khóa kích thước khung hình)
- **Tuyệt đối không có Scrollbar:** Giao diện được khóa chặt bằng thuộc tính `width: 100%; height: 100%; overflow: hidden;` trên CSS toàn cục (`html`, `body`, `#root`). Mọi nội dung game phải được fit vừa vặn vào một màn hình duy nhất, cấm sử dụng thanh cuộn.
- **Layout Spacing:** Các icon người chơi (Opponent Avatar) được phân bổ rộng rãi với khoảng cách trải đều (`justify-evenly`, `max-w-7xl`, `gap-8`), không để dư thừa những khoảng trống vô nghĩa trên màn hình.
- **Hiển thị Hand bài:** Không dùng hiệu ứng thanh cuộn ngang/dọc cho vùng chứa bài (của người chơi và đối thủ). Mọi quân bài được show trọn vẹn, hiệu ứng quạt (fanned) được căn chỉnh overlap đè ngay mép dưới avatar đối thủ để tạo cảm giác trực quan 3D ấn tượng.

### 6.2. Non-blocking Overlays (Giao diện không che chắn)
- **Quy tắc hiển thị Overlays:** Các hiệu ứng chờ (như đòi bài `FAVOR`, cướp bài, xem trước tương lai) phải hiển thị gọn gàng ở giữa trung tâm, không làm mờ hoặc vô hiệu hóa các vùng chứa nút bấm quan trọng.
- Người chơi luôn phải có khả năng tương tác để tung ra lá `NOPE` bất cứ lúc nào khi `actionWindow` đang đếm ngược.

### 6.3. Action Window (Cửa sổ hành động đếm ngược 5 giây)
- Mọi hành động gây hấn (Cướp bài, Favor, Attack) sẽ mở ra một thời gian chờ (5s).
- Nếu không bị chặn bằng lá Nope, hệ thống backend tự động resolve (tự động cướp hoặc trừ thẻ) để chống kẹt ván đấu.

### 6.4. Micro-animations (Hiệu ứng tinh tế)
- **Tính chính xác:** Thời gian hiệu ứng phải khớp hoàn toàn với logic game (vd: Hiệu ứng xáo bài `isShuffling` chính xác là 1 lần trượt 1000ms, không lặp lại vô tận gây lỗi thị giác).