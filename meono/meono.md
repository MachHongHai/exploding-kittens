# EXPLODING KITTENS - BASE GAME & BOT LOGIC (2D WEB GAME)

## 1. GAME OVERVIEW
- **Thể loại:** Turn-based Card Game (2-5 Players).
- **Mục tiêu:** Sống sót cuối cùng bằng cách không bốc phải lá `Exploding Kitten` (Mèo Nổ), hoặc có lá `Defuse` (Tháo ngòi) để gỡ bom.
- **Chế độ chơi (Game Modes):** - PvP: Chơi với người (Tạo phòng / Ghép ngẫu nhiên).
  - PvE: Chơi với Bot (3 cấp độ: Dễ, Trung bình, Khó).

---

## 2. CARD DATABASE (CƠ SỞ DỮ LIỆU BÀI)
Thuộc tính cơ bản của mỗi Card Object: `id`, `type`, `name`, `actionType` (Action/Reaction/None), `description`.

| Loại bài (Type) | Số lượng | Action Type | Chức năng (Logic Code) |
| :--- | :---: | :--- | :--- |
| `ExplodingKitten` | 4 | Auto | Kích hoạt Event Bị loại (Eliminate) nếu Player không có `Defuse`. |
| `Defuse` | 6 | Reaction | Hủy Event Bị loại. Cho phép chèn lại `ExplodingKitten` vào `DrawPile` ở `index` tùy chọn. |
| `Attack` | 4 | Action | `EndTurn()` lập tức. Chuyển `turnsToPlay = 2` cho Player tiếp theo. (Cộng dồn nếu đánh đè). |
| `Skip` | 4 | Action | `EndTurn()` lập tức. Trừ `turnsToPlay` đi 1. |
| `Favor` | 4 | Action | Chọn `targetPlayer`. `targetPlayer` tự đưa 1 card từ tay sang `currentPlayer`. |
| `Shuffle` | 4 | Action | `Randomize()` mảng `DrawPile`. |
| `SeeTheFuture` | 5 | Action | Lấy dữ liệu 3 phần tử cuối của mảng `DrawPile` hiển thị cho người đánh. |
| `Nope` | 5 | Reaction | Hủy action của lá Action vừa đánh. Có thể đánh bất kỳ lúc nào, kể cả đè lên Nope khác. |
| `CatCard` (5 loại) | 20 | Action | Đánh 2 lá giống nhau = Rút ngẫu nhiên 1 card từ tay `targetPlayer`. |

---

## 3. GAME SETUP ALGORITHM (THUẬT TOÁN BẮT ĐẦU VÁN)
1. Lọc tất cả `ExplodingKitten` (4) và `Defuse` (6) ra khỏi 56 lá.
2. Trộn đều 46 lá thường.
3. Chia cho mỗi Player/Bot: **1 lá `Defuse`** + **7 lá thường**. (Tổng 8 lá trên tay)
4. Tính số mìn: `bombCount = totalPlayers - 1`.
5. Đưa `bombCount` lá `ExplodingKitten` và `Defuse` thừa vào `DrawPile`. Trộn đều `DrawPile`.

---

## 4. GAME LOOP & STATE MACHINE (VÒNG LẶP LƯỢT ĐI)
Trong lượt của mình, người chơi có 2 lựa chọn tuần tự:

**Trạng thái 1: Action Phase (Giai đoạn Đánh bài)**
- `currentPlayer` có thể chọn **Pass** (không đánh bài nào) hoặc **Play** (đánh bao nhiêu lá bài tùy thích từ `Hand` xuống `DiscardPile`).
- Khi đánh bài Action, hiệu ứng của bài được kích hoạt ngay. (Cần delay nhỏ để check thẻ `Nope` từ người chơi khác).

**Trạng thái 2: Draw Phase (Giai đoạn Rút bài - Bắt buộc để kết thúc lượt)**
- Khác với các game khác, lượt đi **CHỈ KẾT THÚC khi người chơi Rút bài** (trừ khi dùng Skip/Attack).
- Rút 1 lá trên cùng của `DrawPile`.
- **If** Card != `ExplodingKitten`: Vào tay -> `turnsToPlay -= 1`. Check End Turn.
- **If** Card == `ExplodingKitten`:
  - **If KHÔNG có `Defuse`:** `EliminatePlayer()`. Xóa bài. Chuyển Turn.
  - **If CÓ `Defuse`:** Bỏ `Defuse` vào `DiscardPile` -> Chọn `selectedIndex` -> `DrawPile.insert(ExplodingKitten, selectedIndex)` -> `turnsToPlay -= 1`. Check End Turn.

---

## 5. SPECIAL COMBOS (CÁC TỔ HỢP ĐẶC BIỆT)
- **Pair (2 lá giống nhau):** Đánh 2 lá bất kỳ giống nhau (thường là Cat Cards). Bạn phải chọn 1 đối thủ. Hệ thống sẽ bốc mù ngẫu nhiên 1 lá từ tay đối thủ đó cho bạn.
- **Three of a Kind (3 lá giống nhau):** Đánh 3 lá bất kỳ giống nhau. Bạn chọn 1 đối thủ và đoán tên 1 loại bài (ví dụ: "Defuse").
  - Nếu đối thủ có: Họ bắt buộc phải đưa cho bạn.
  - Nếu đối thủ không có: Trò chơi sẽ thông báo lỗi và cho phép bạn đoán lại loại bài khác mà không làm mất 3 lá bài của bạn.

---

## 6. UI/UX MECHANICS (CƠ CHẾ GIAO DIỆN)
- **Multi-select:** Người chơi có thể click để chọn nhiều lá bài trên tay. Bài được chọn sẽ nổi lên cao và có viền sáng.
- **Action Play:** Khi đã chọn bài hợp lệ, người chơi có thể:
  1. Bấm nút **"Play X Cards"** nổi lên trên bộ bài.
  2. **Vuốt/Kéo (Swipe/Drag):** Nhấn giữ các lá bài đã chọn và vuốt lên khu vực giữa bàn (Hitbox) để đánh bài nhanh.

---

## 7. PVE MODE: BOT LOGIC SYSTEM (HỆ THỐNG TRÍ TUỆ NHÂN TẠO)
Tạo class/function `BotController` lắng nghe lượt đi. Yêu cầu thêm `setTimeout(2000, 3000)` giả lập thời gian "suy nghĩ" trước mỗi Action để người chơi theo kịp nhịp độ.

### Cấp độ 1: Dễ (EasyBot) - Hành động ngẫu nhiên
- **Action Phase:** Quét các thẻ bài đang có. Dùng `Math.random()`. Tỷ lệ 50% sẽ đánh ngẫu nhiên 1 lá Action bất kỳ không màng hoàn cảnh, 50% bỏ qua và đi thẳng đến bước rút bài.
- **Defuse Phase:** Nếu nổ và có `Defuse`, luôn gọi lệnh `InsertKitten(index = 0)` (đặt ngay trên đầu) hoặc random index.

### Cấp độ 2: Trung bình (MediumBot) - Kịch bản Rule-Based
- **Action Phase (Phòng thủ):**
  - Kích hoạt điều kiện check: **If** `turnsToPlay > 1` (Đang bị Attack) -> Check `Hand`. Nếu có `Attack` hoặc `Skip`, bắt buộc đánh ra để né.
  - **If** `DrawPile.length <= 10` -> Tự động đánh `See The Future` hoặc `Shuffle` nếu có trên tay.
- **Defuse Phase:** Luôn tính toán gài bẫy. Kích hoạt `InsertKitten(index = 1)` hoặc `index = 2` để bẫy người chơi tiếp theo.
- **Nope Logic:** Tỷ lệ đánh `Nope` là random (50%) khi người chơi xài Action Card.

### Cấp độ 3: Khó (AIBot) - Sức mạnh từ Large Language Model (Gemini)
- **Cơ chế:** Kết nối trực tiếp với Google Gemini API.
- **Quy trình xử lý:**
  1. Backend đóng gói toàn bộ trạng thái game hiện tại (bài trên tay, số lượng bài trong xấp rút, các lá bài đã đánh, lịch sử các lượt đi gần nhất) thành một prompt chi tiết.
  2. Gemini AI sẽ phân tích tình huống, tính toán rủi ro và đưa ra quyết định tối ưu nhất.
  3. AI trả về dữ liệu cấu trúc (Structured JSON) chứa hành động cụ thể (ví dụ: đánh bài gì, nhắm vào ai, hoặc rút bài).
- **Đặc điểm:** Có khả năng ứng biến linh hoạt, biết "lừa" người chơi, và đưa ra các nước đi không lường trước được thay vì chỉ dựa vào các quy tắc cứng.
- **Nope Logic:** AI tự quyết định có chặn Action của đối thủ hay không dựa trên tầm quan trọng của Action đó đối với cục diện trận đấu.