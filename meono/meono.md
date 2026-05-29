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

## 2. CÔNG NGHỆ SỬ DỤNG (TECHNOLOGY STACK)

Dự án được xây dựng dựa trên kiến trúc client-server hiện đại, tối ưu hóa cho trải nghiệm thời gian thực:

### 2.1. Frontend (Client)
- **Framework:** [React](https://react.dev/) kết hợp với [TypeScript](https://www.typescriptlang.org/) giúp quản lý state chặt chẽ và tăng độ tin cậy của code.
- **Styling & Theme:** [Tailwind CSS](https://tailwindcss.com/) cho thiết kế giao diện nhanh chóng, linh hoạt và đáp ứng tốt trên mọi thiết bị (Responsive).
- **Animations:** [Framer Motion](https://www.framer.com/motion/) tạo các hiệu ứng chuyển động mượt mà như: bài bay từ chồng bài rút về tay người chơi, thẻ bài xoay góc ngẫu nhiên khi đánh vào chồng bài bỏ, và hiệu ứng zoom/tilt 3D của thẻ bài.

### 2.2. Backend (Server)
- **Runtime:** [Node.js](https://nodejs.org/) chạy [Express](https://expressjs.com/) viết bằng TypeScript.
- **Real-time Communication:** [Socket.IO](https://socket.io/) truyền tải trạng thái trò chơi thời gian thực với độ trễ cực thấp giữa client và server.

### 2.3. AI Engine (LLM Integration)
- **API:** Tích hợp [Google Gemini API](https://ai.google.dev/) để cung cấp chế độ chơi Gemini AI, cho phép mô hình ngôn ngữ lớn (LLM) phân tích thế trận và đưa ra quyết định chơi thẻ bài dưới dạng JSON. Có cơ chế fallback tự động về MediumBot nếu API gặp sự cố hoặc quá tải.

---

## 3. CƠ SỞ DỮ LIỆU BÀI & CƠ CHẾ COMBO TIÊU CHUẨN

| Loại bài (Card Type) | Loại hành động | Chức năng (Game Logic) |
| :--- | :--- | :--- |
| `EXPLODING_KITTEN` | Tự động | Buộc người chơi gỡ bom bằng `Defuse` hoặc bị loại (Eliminated) ngay lập tức. |
| `DEFUSE` | Phản hồi | Hủy trạng thái nổ bom. Cho phép người chơi gài ngược lại lá bom vào vị trí tùy chọn trong bộ bài rút mà không cho người khác biết. |
| `ATTACK` | Hành động | Kết thúc lượt ngay lập tức mà không cần rút bài, buộc người tiếp theo thực hiện 2 lượt liên tiếp. **Cộng dồn (Chained Attack):** Đánh đè Attack khi đang bị Attack sẽ cộng dồn số lượt còn lại + 2 lượt sang cho nạn nhân tiếp theo. |
| `SKIP` | Hành động | Kết thúc lượt lập tức mà không cần rút bài. Trừ đi 1 lượt phải đi (`turnsToPlay`). |
| `FAVOR` | Hành động | Buộc 1 đối thủ tự chọn và đưa 1 lá bài bất kỳ của họ cho bạn. |
| `SHUFFLE` | Hành động | Xáo trộn ngẫu nhiên toàn bộ chồng bài rút (`DrawPile`). |
| `SEE_THE_FUTURE` | Hành động | Xem trước 3 lá bài trên cùng của chồng bài rút (`DrawPile`). |
| `NOPE` | Phản hồi | Hủy tác dụng của lá bài vừa đánh (trừ Exploding Kitten và Defuse). Cho phép phản hồi liên tiếp (Nope đè Nope) tạo thành chuỗi. |
| `CAT_CARD` (5 loại) | Hành động | Các thẻ bài mèo thường (không có tính năng đơn lẻ). Dùng để thực hiện Combo. |

### Luật Combo chuẩn của Meono:
- **Đôi (Pair):** Đánh 2 lá mèo giống nhau để trộm ngẫu nhiên 1 lá bài từ tay đối thủ.
- **Bộ ba (Three of a Kind):** Đánh 3 lá mèo giống nhau để yêu cầu đích danh 1 loại bài từ đối thủ. Nếu đối thủ có lá bài đó, họ bắt buộc phải đưa cho bạn.
- **Luật giữ bài khi đoán sai:** Trong Meono, nếu bạn đánh bộ ba và đoán sai (đối thủ không có lá bài yêu cầu), **hành động sẽ thất bại nhưng 3 lá bài mèo vẫn được giữ lại trên tay bạn** (không bị mất), bạn có thể thử yêu cầu lá khác hoặc chọn mục tiêu khác.
- **Giới hạn nguyên liệu:** Chỉ sử dụng các lá Mèo thường (`CAT_CARD`) để làm combo. Chỉ trong các trường hợp cực kỳ tuyệt vọng (sắp nổ bom, không có Defuse và không còn lối thoát), hệ thống mới cho phép hiến tế các lá bài chức năng (như Skip, Attack, Shuffle...) làm combo.

---

## 4. CHI TIẾT HỆ THỐNG TRÍ TUỆ NHÂN TẠO (AI BOT LOGIC)

Hệ thống AI của Meono không chỉ dựa trên các tập luật đơn giản mà là một công cụ phân tích heuristics phức tạp, mô phỏng tâm lý và chiến thuật của người chơi ngoài đời thực:

### 4.1. Bộ Nhớ Đỉnh Bài Hoàn Hảo (Deck Memory & Safety Net)
- **Ghi nhớ chính xác:** Khi Bot sử dụng `See The Future` hoặc biết vị trí bom vừa đặt qua hành động gài bom của chính mình, Bot sẽ lưu trữ trạng thái này trong bộ nhớ `knownDeckTop`.
- **Duy trì bộ nhớ:** Trạng thái này chỉ bị xóa khi có hành động xáo bài (`Shuffle`), khi có người rút bài hoặc khi người khác vừa đặt bom mới. Các hành động như cướp bài, xin bài không làm Bot "quên" bom.
- **Phòng thủ tuyệt vọng (`getLastResortAction`):** Khi biết chắc chắn bom đang ở trên cùng và chuẩn bị rút bài, Bot sẽ kích hoạt chế độ tự vệ tối đa:
  1. Quét lại toàn bộ hand xem có lá thoát nào vừa trộm được không (Attack/Skip/Shuffle).
  2. Cố gắng tạo combo (Đôi/Ba/Favor) để cướp bài thoát từ người khác, chấp nhận hiến tế bài chức năng.
  3. Đánh `See The Future` để kéo dài thời gian (stall) chờ cơ hội.
  4. Chỉ chấp nhận rút bài khi hoàn toàn cạn kiệt mọi phương án.

### 4.2. Hệ Thống Thâm Thù (The Grudge System - Vendetta)
- Bot có khả năng ghi nhớ tối đa **30 hành động gần nhất** trong trận đấu.
- **Tăng tiến thù hằn:** Bot sẽ chấm điểm thù hằn đối với từng người chơi dựa trên hành động của họ nhắm vào Bot:
  - Bị cướp bài (Pair/Triplet), xin bài (Favor): `+8.0 điểm`.
  - Bị đối phương đánh `Nope!` chặn hành động của mình: `+12.0 điểm` (Mức thù hằn cao nhất).
- **Trọng số thời gian (Recency Weight):** Các hành động càng mới xảy ra sẽ được nhân hệ số từ **1.0 đến 3.0**, khiến Bot nhạy cảm hơn với những kẻ vừa khiêu khích nó. Bot sẽ ưu tiên xả bài tấn công (Attack, Favor, Combos) lên kẻ có điểm thù hằn cao nhất.

### 4.3. Biến Thiên Tâm Lý (Variable Mindsets)
Khi lựa chọn mục tiêu tấn công, Bot sẽ quyết định dựa trên một trong hai chế độ tâm lý được gieo ngẫu nhiên theo lượt:
1. **Eat the Rich (70% cơ hội):** Bot tập trung kiềm chế người chơi đang dẫn đầu (hoặc có số bài trên tay vượt trội so với trung bình cả phòng).
2. **Ruthless Execution (30% cơ hội):** Bot chuyển sang chế độ tàn nhẫn, tập trung tiêu diệt những người chơi yếu thế nhất (đặc biệt là những người có số bài `<= 2`), nhằm mục đích loại bớt đối thủ để nhanh chóng kết thúc ván đấu.

### 4.4. Khai Thác Điểm Yếu (Vulnerability Exploitation)
Bot liên tục theo dõi xem người chơi nào đã hết lá gỡ bom (`Defuse`) bằng cách ghi nhớ những ai vừa kích nổ bom và phải dùng Defuse nhưng chưa thực hiện thêm các combo cướp bài nào để lấy lại. Bot sẽ dồn sát thương (Attack) hoặc đặt bom ngay trên đỉnh bộ bài (vị trí `0`) để hạ gục những người chơi không còn phòng vệ này.

### 4.5. Phối Hợp Trận Đấu & Hỗ Trợ Nope (Collusion & Nope Helper)
Bot không chơi ích kỷ mà biết phân tích cục diện chung để cản bước người mạnh nhất hoặc hỗ trợ đồng minh gián tiếp:
- **Nope bên thứ ba (Third-party Nope):** Nếu người chơi dẫn đầu (Leader) đánh `Attack` hoặc `Favor` nhắm vào một người chơi yếu khác, Bot sẵn sàng đánh `Nope` từ trên tay của mình để bảo vệ người kia và kiềm tỏa Leader.
- **Counter-Nope:** Nếu một người chơi khác đánh bài tấn công Leader, và bị Leader `Nope` lại, Bot sẽ lập tức đánh chồng `Nope` lên lá `Nope` của Leader (để kích hoạt lại đòn tấn công ban đầu).

### 4.6. Cơ Chế Đặt Bom Thông Minh (Defuse Placement)
Khi Bot phải đặt bom sau khi tháo ngòi:
- Nếu Bot đang bị dồn lượt rút (`turnsToPlay > 1`), Bot sẽ tính toán đặt bom ở độ sâu an toàn vượt ngoài tầm rút của mình trong lượt đó để tránh tự sát.
- Nếu nạn nhân tiếp theo không có `Defuse`, Bot đặt bom ngay ở vị trí `0` (trên cùng) để hạ gục đối thủ lập tức.
- Nếu đối phương có `Defuse`, Bot đặt ngẫu nhiên ở độ sâu từ `1` đến `3` để ép đối thủ tiêu tốn tài nguyên gỡ bom ở các vòng sau.

---

## 5. THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM CHIẾN GAME (UI/UX)

Giao diện của Meono được thiết kế để mang lại cảm giác của một trò chơi thẻ bài kỹ thuật số cao cấp và sống động:

- **Cute Kitten Avatars:** Thay thế các vòng tròn hình học đơn điệu bằng bộ avatar mèo hoạt họa cực kỳ đáng yêu. Màu sắc và biểu cảm của các avatar thay đổi theo vị trí người chơi và trạng thái hành động.
- **Arcade Nope Button:** Nút phản hồi Nope được thiết kế như một nút bấm khẩn cấp 3D của máy game thùng, tự động phát sáng neon đỏ rực và rung lắc mạnh mẽ khi đến thời gian cửa sổ Nope mở ra, kích thích phản xạ của người chơi.
- **High-tech Defusal Kit:** Giao diện đặt bom khi tháo ngòi mô phỏng một thiết bị gỡ bom công nghệ cao với font chữ LCD, nền quét scanline cổ điển, nút bấm neon và thanh trượt trực quan.
- **Scroll of Acts:** Lịch sử trò chơi được trình bày dưới dạng một cuộn thư cổ điển tự động cuộn, ghi lại chi tiết mọi hành động kèm Emoji biểu cảm sinh động, giúp người chơi dễ dàng theo dõi diễn biến trận đấu.
- **Holographic Cards & 3D Tilt:** Các lá bài quan trọng (Defuse, Exploding Kitten) có lớp phủ gradient hào quang (holographic sheen). Khi rê chuột lên các lá bài trên tay, chúng sẽ nghiêng theo góc nhìn 3D vật lý chân thực.
- **Action Window Delay:** Cửa sổ đếm ngược Nope kéo dài 5 giây giúp cuộc chơi mượt mà, kết hợp với thời gian delay thông minh của Bot để người chơi có thể phản ứng kịp thời.