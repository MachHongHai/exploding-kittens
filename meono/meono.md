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
- **Giới hạn nguyên liệu:** Chỉ sử dụng các lá Mèo thường (`CAT_CARD`) để làm combo. Tuy nhiên, trong chế độ Tuyệt vọng (Desperation Mode) - khi sắp nổ bom hoặc **bộ bài rút chỉ còn đúng 1 lá** mà không có lối thoát, hệ thống cho phép hiến tế cả các lá chức năng (như Skip, Attack, Shuffle, See The Future...) để làm combo cướp bài. Đặc biệt ở tình huống 1 lá cuối cùng (chắc chắn là bom), AI sẽ không bao giờ đánh lẻ các lá `Shuffle` hoặc `See The Future` vì vô tác dụng, mà thay vào đó sẽ ghép chúng thành bộ đôi/bộ ba để cướp cơ hội sống sót từ đối thủ.

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

### 4.7. Khắc phục lỗi tự chặn (Self-Nope Prevention)
- **Sửa lỗi logic:** Khắc phục triệt để lỗi AI tự đánh lá `Nope` để phủ quyết hành động chức năng của chính mình (ví dụ: tự `Nope` lá `Skip` hoặc `Attack` do chính mình vừa đánh).

---

## 5. THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM CHIẾN GAME (UI/UX)

Giao diện của Meono được thiết kế để mang lại cảm giác của một trò chơi thẻ bài kỹ thuật số cao cấp, sống động và mượt mà:

- **Avatar Mèo Hoạt Họa (Cute Kitten Avatars):** Thay thế các vòng tròn hình học đơn điệu bằng bộ avatar mèo hoạt họa cực kỳ đáng yêu. Màu sắc và biểu cảm của các avatar thay đổi theo vị trí người chơi và trạng thái hành động.
- **Nút Nope Động & Thông Minh (Intelligent Nope Button):**
  - Thiết kế như một nút bấm khẩn cấp 3D của máy game thùng, tự động phát sáng neon đỏ rực và rung lắc mạnh mẽ khi đến thời gian cửa sổ Nope mở ra.
  - **Tối ưu hóa logic:** Nút Nope chỉ phát sáng khi có hành động hợp lệ từ đối thủ có thể bị Nope. Nút sẽ không sáng khi người chơi tự đánh bài hoặc khi đối thủ dùng lá `Defuse` để tháo bom. Người chơi vẫn có thể di chuột tương tác (hover) với nút Nope bất cứ lúc nào để tăng cảm giác phản hồi trực quan.
- **Giao Diện Gỡ Bom LCD (High-tech Defusal Kit):** Giao diện đặt bom khi tháo ngòi mô phỏng một thiết bị gỡ bom công nghệ cao với font chữ LCD, nền quét scanline cổ điển, nút bấm neon và thanh trượt trực quan.
- **Bảng Nhật Ký Cổ Điển (Scroll of Acts):** Lịch sử trò chơi được trình bày dưới dạng một cuộn thư cổ điển tự động cuộn, ghi lại chi tiết mọi hành động kèm Emoji biểu cảm sinh động. Đã loại bỏ dòng tiêu đề "Scroll of Acts" cứng nhắc để cuộn thư hòa hợp tự nhiên vào bàn gỗ.
- **Thẻ Bài Nghiêng 3D & Holographic:** Các lá bài quan trọng (Defuse, Exploding Kitten) có lớp phủ gradient hào quang (holographic sheen). Khi rê chuột lên các lá bài trên tay, chúng sẽ nghiêng theo góc nhìn 3D vật lý chân thực.
- **Luôn Luôn Tương Tác (Always-Interactive Hand):** Cho phép người chơi di chuột, xem thông tin và chọn bài kể cả khi chưa tới lượt hoặc trong khoảng nghỉ khi các Bot đang thực hiện hành động, loại bỏ cảm giác giao diện bị đơ/khóa.
- **Hiệu Ứng Báo Lượt "YOUR TURN":** Thay thế dòng chữ tĩnh bằng một biểu ngữ hoạt họa "YOUR TURN" phóng to giữa màn hình rồi biến mất nhanh chóng giống như đếm ngược, giúp người chơi tập trung và đẩy nhanh nhịp độ trận đấu.
- **Bố Trí Bàn Chơi Cân Đối (Optimized Layout):**
  - **Hand bài:** Được đẩy cao lên một chút để không bị che khuất phần dưới của lá bài.
  - **Xấp bài rút và xấp bài bỏ (Discard Pile):** Tăng kích thước hiển thị lớn hơn, dịch chuyển xuống dưới một chút để tạo khoảng cách thoáng đãng với các avatar đối thủ ở phía trên.
  - **Xấp bài bỏ tối giản:** Loại bỏ khung viền dashed và dòng chữ "Empty" khi xấp bài bỏ trống để nó hòa vào nền gỗ tự nhiên. Các lá bài bỏ sẽ xếp chồng chéo lên nhau ngẫu nhiên khi trận đấu diễn ra.
- **Tinh Chỉnh Nút Play:**
  - Ẩn số lượng đếm lá bài chọn phía sau chữ Play (chỉ hiển thị "Play" thay vì "Play (1)", "Play (2)").
  - Di chuyển vị trí nút Play cao lên một chút (`-top-14`) để không bị các lá bài đang chọn nảy lên đè khuất khi nhấp vào chúng.
- **Cải Thiện Độ Mượt & Thao Tác Nhanh (Rapid Interaction Fixes):**
  - Tăng tốc độ phản hồi chung của trò chơi giúp các bot đánh bài nhanh và dứt khoát hơn.
  - Loại bỏ các cảnh báo lỗi đỏ khó chịu ("An action is waiting for Nope...") khi người chơi click chuột nhanh liên tục.
  - Sửa lỗi kẹt hoạt ảnh (như chữ "YOUR TURN" hoặc hiệu ứng "Shuffle" bị treo cứng trên màn hình khi người chơi thao tác cực nhanh) bằng cách bổ sung dọn dẹp (cleanup) và thiết lập lại trạng thái (reset state) trong React Effects.