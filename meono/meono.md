# MEONO - EXPLODING KITTENS DIGITAL EDITION

Tài liệu này cung cấp cái nhìn toàn diện về dự án **Meono** - một bản sao kỹ thuật số cao cấp của tựa game thẻ bài nổi tiếng **Exploding Kittens** (Mèo Nổ), bao gồm kiến trúc hệ thống, các công nghệ sử dụng, thiết kế UI/UX và cơ chế trí tuệ nhân tạo (AI Bot) nâng cao.

---

## 1. TỔNG QUAN DỰ ÁN (PROJECT OVERVIEW)
- **Thể loại:** Turn-based Card Game (Trò chơi thẻ bài theo lượt) dành cho từ 2 đến 5 người chơi.
- **Mục tiêu:** Trở thành người chơi sống sót cuối cùng bằng cách tránh bốc phải lá `Exploding Kitten` (Mèo Nổ), hoặc sử dụng lá `Defuse` (Tháo ngòi) để gỡ bom và gài lại vào bộ bài.
- **Chế độ chơi (Game Modes):**
  - **PvP (Multiplayer):** Chơi trực tuyến thời gian thực với những người chơi khác qua hệ thống phòng (Room) và ghép trận.
  - **PvE (Singleplayer):** Chơi ngoại tuyến với AI Bots thông minh có 4 cấp độ: Dễ (Easy), Trung bình (Medium), Khó (Hard/Expert), và Gemini AI.

---

## 2. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Dự án được xây dựng theo mô hình **Monorepo** với TypeScript đồng bộ trên toàn bộ stack:

### 2.1. Cấu trúc thư mục & Quản lý File
- **`shared/src/types.ts`**: Định nghĩa "ngôn ngữ chung" của dự án (CardType, GameState, PlayerAction).
- **`backend/src/`**:
  - **`socket/GameGateway.ts`**: "Người gác cổng" điều phối kết nối, đếm ngược thời gian (Timer) và đồng bộ hóa trạng thái.
  - **`game/GameEngine.ts`**: Bộ máy điều hành chính, quản lý lượt đi, luật chơi cơ bản và vòng lặp "Nope".
  - **`game/OriginalAIBot.ts`**: Trí tuệ nhân tạo cho bộ bài gốc (Easy/Medium/Hard).
  - **`game/expansions/`**: Nơi chứa logic biệt lập cho các bản mở rộng (Plug & Play).
    - **`ImplodingGameLogic.ts`**: Luật chơi riêng của bản Imploding.
    - **`ImplodingAIBot.ts`**: Bộ não nâng cao dành riêng cho bản Imploding (Kế thừa từ OriginalAIBot).
  - **`game/decks/`**: Các bộ cấu hình bài (`OriginalDeck.ts`, `ImplodingKittensDeck.ts`).
- **`frontend/src/`**:
  - **`components/GameBoard.tsx`**: Trung tâm hiển thị bàn chơi, xử lý animation và modals.
  - **`hooks/useGameState.ts`**: Hook kết nối thời gian thực với server qua Socket.io.

### 2.2. Công nghệ sử dụng
- **Frontend:** React + Vite + Tailwind CSS + Framer Motion.
- **Backend:** Node.js + Express + Socket.IO.
- **AI Engine:** Tích hợp trực tiếp Google Gemini API cho chế độ chơi AI nâng cao.

---

## 3. CƠ CHẾ GAME ĐẶC TRƯNG & BẢN MỞ RỘNG (EXPANSIONS)

### 3.1. Các loại thẻ bài & Tính năng
| Loại bài | Bộ bài | Chức năng (Game Logic) |
| :--- | :--- | :--- |
| `EXPLODING_KITTEN` | Gốc | Buộc gỡ bom bằng `Defuse` hoặc bị loại. |
| `IMPLODING_KITTEN` | Imploding | Lần bốc 1: Đặt lại vào deck mặt ngửa và kết thúc lượt ngay. Lần bốc 2 (mặt ngửa): Nổ ngay lập tức, **không thể gỡ**. |
| `REVERSE` | Imploding | Đảo ngược chiều chơi và kết thúc lượt mà không cần rút bài. |
| `DRAW_FROM_BOTTOM`| Imploding | Kết thúc lượt bằng cách rút lá bài cuối cùng dưới đáy chồng bài. |
| `TARGETED_ATTACK` | Imploding | Kết thúc lượt và chọn đích danh 1 người phải thực hiện 2 lượt liên tiếp. |
| `ALTER_THE_FUTURE`| Imploding | Xem trước và **sắp xếp lại** 3 lá bài trên cùng. |
| `NOPE` | Gốc | Hủy tác dụng của lá bài vừa đánh. Hỗ trợ chuỗi Nope (Yup!). |
| `FERAL_CAT` | Gốc | Lá bài Wildcard: Có thể kết hợp với bất kỳ lá Mèo thường nào khác để tạo Combo. |

### 3.2. Quy tắc Logic Nâng cao
- **Khóa tương tác (`isInteractionPending`)**: Hệ thống tự động chặn hành động rút bài khi có bất kỳ cửa sổ tương tác nào đang mở (Nope window, chọn mục tiêu, gỡ bom). Đảm bảo tính minh bạch và tránh lỗi đồng bộ.
- **Deduplication Animation**: Hệ thống thông minh chỉ kích hoạt popup hiệu ứng cho các hành động đánh bài lần đầu, tránh hiển thị lặp lại khi hành động đó được thực thi sau cửa sổ "Nope".

---

## 4. CHI TIẾT TRÍ TUỆ NHÂN TẠO (AI BOT INTELLIGENCE)

Bot của Meono được thiết kế để chơi như những "Pro Player":

### 4.1. Khả năng Suy luận & Chiến thuật
- **Nghi vấn công khai (`isTopCardSuspect`)**: Nếu một người chơi dùng *See The Future* rồi lập tức dùng thẻ thoát (Skip/Attack), tất cả Bot sẽ tự động hiểu lá trên cùng là Bom và tuyệt đối không bốc bài, cũng như không lãng phí thêm lá *See The Future* của chính mình.
- **Hệ thống Thâm thù (Grudge)**: Bot ghi nhớ 30 hành động gần nhất và ưu tiên tấn công những người đã từng cướp bài hoặc `Nope` mình. Điểm thù hằn được tính toán dựa trên mức độ nghiêm trọng và thời gian xảy ra.
- **Ưu tiên Defuse**: Khi dùng combo 3 lá, Bot luôn ưu tiên hàng đầu việc cướp lá `DEFUSE` từ đối thủ nếu họ có.

### 4.2. Logic đặt bom (Insertion)
- **Original**: Đặt vào vị trí ngẫu nhiên hoặc vị trí 0 nếu biết đối thủ không có Defuse.
- **Imploding**: Bot tính toán để đặt lá Imploding Kitten (mặt ngửa) vượt qua số lượt rút của chính mình nếu đang bị tấn công, hoặc thực hiện "Kill Shot" lên người kế tiếp.

---

## 5. THIẾT KẾ UI/UX & ANIMATIONS

- **Kitten Chance Gauge**: Đồng hồ đo tỷ lệ nổ ở cạnh trái màn hình, có hiệu ứng rung lắc, bốc khói và tia lửa theo độ nguy hiểm tăng dần. Tính toán chính xác cả thẻ Exploding và Imploding.
- **Fanned Hand**: Bài trên tay được xếp hình nan quạt, hỗ trợ kéo thả và nghiêng 3D thực tế.
- **Action History Scroll**: Nhật ký trận đấu được trình bày trên một cuộn giấy cổ điển, tự động ghi lại mọi diễn biến với Emoji.
- **3D Popups**: Các chữ thông báo (REVERSE!, ATTACK!, KABOOM!) được thiết kế nổi khối, màu sắc rực rỡ và có chiều sâu.

---
*Cập nhật lần cuối: Tháng 5, 2026*
