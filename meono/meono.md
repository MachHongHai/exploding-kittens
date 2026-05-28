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
| `NOPE` | Reaction | Hủy tác dụng của lá Action vừa đánh (ngoại trừ Exploding Kitten và Defuse). |
| `CAT_CARD` (5 loại) | Action | Các lá bài mèo thường (Tacocat, Cattermelon, Hairy Potato, Beard Cat, Rainbow-Ralphing). Đánh theo đôi (Pair) để trộm ngẫu nhiên 1 lá từ tay đối thủ. |

---

## 3. GAME SETUP ALGORITHM (THUẬT TOÁN KHỞI TẠO BỘ BÀI CHUẨN)
Để trò chơi cân bằng và đúng luật Mèo Nổ tiêu chuẩn, hệ thống tự động tối ưu hóa số lượng bài dựa trên số lượng người chơi:

1. **Chia bài khởi đầu:**
   - Mỗi người chơi (bao gồm cả Bot) nhận đúng **1 lá `DEFUSE`**.
   - Phát thêm **7 lá bài thường** từ xấp bài đã trộn. (Mỗi người chơi bắt đầu ván đấu với **8 lá bài trên tay**).
2. **Số lượng mìn (Exploding Kittens):**
   - Đưa vào bộ bài số lá bom đúng bằng `Số người chơi - 1`. (Ví dụ: ván PvE 4 người chơi gồm 1 Người và 3 Bot sẽ có 3 bom).
3. **Số lượng Defuse dư xáo lại vào bộ bài rút:**
   - **Với ván 2-3 người chơi:** Chỉ xáo **đúng 2 lá `DEFUSE` còn dư** vào bộ bài rút (các lá dư khác bị loại bỏ).
   - **Với ván từ 4 người chơi trở lên:** Xáo **toàn bộ số lá `DEFUSE` còn dư** vào bộ bài rút.
4. **Phân bổ số lượng bài chức năng (theo cơ chế Paw Print của Party Pack):**
   - **Nếu ván đấu chỉ có 2-3 người chơi:** Hệ thống rút gọn bộ bài rút để đẩy nhanh nhịp độ (Attack: 2, Skip: 4, Favor: 2, Shuffle: 2, See The Future: 3, Nope: 4, các loại Mèo thường: 3 lá/loại).
   - **Nếu ván đấu có từ 4 người chơi trở lên:** Sử dụng toàn bộ 46 lá chức năng chuẩn của bộ bài (Attack: 4, Skip: 4, Favor: 4, Shuffle: 4, See The Future: 5, Nope: 5, các loại Mèo thường: 4 lá/loại).

---

## 4. GAME LOOP & STATE MACHINE (VÒNG LẶP LƯỢT ĐI)
Một lượt chơi bao gồm 2 giai đoạn chính:

* **Action Phase (Giai đoạn Đánh bài):**
  - Người chơi có quyền đánh bất kỳ số lượng lá bài hợp lệ nào từ tay mình xuống xấp bài bỏ (`DiscardPile`) hoặc chọn **Pass** (không đánh bài) để chuyển qua giai đoạn rút bài.
  - Khi đánh các lá Action, hiệu ứng được kích hoạt ngay lập tức.
* **Draw Phase (Giai đoạn Rút bài):**
  - Lượt chơi **chỉ thực sự kết thúc** khi người chơi rút 1 lá từ đỉnh `DrawPile` (ngoại trừ khi đã bỏ lượt bằng Skip hoặc Attack).
  - Nếu rút phải `EXPLODING_KITTEN`:
    - **Không có Defuse:** Người chơi bị loại ngay lập tức.
    - **Có Defuse:** Phải sử dụng lá Defuse, sau đó chọn một vị trí (index) từ `0` (trên cùng) đến cuối bộ bài để chèn bom trở lại xấp bài rút.

---

## 5. SPECIAL COMBOS (CÁC TỔ HỢP ĐẶC BIỆT)
- **Pair (Cặp 2 lá giống nhau):** Cho phép chọn 1 đối thủ và cướp ngẫu nhiên 1 lá bài trên tay họ.
- **Three of a Kind (Bộ 3 lá giống nhau):** Cho phép chọn 1 đối thủ và yêu cầu một loại bài cụ thể (ví dụ: yêu cầu đối thủ đưa lá "Defuse").
  - Nếu đối thủ có loại bài đó: Họ bắt buộc phải đưa cho bạn.
  - Nếu đối thủ không có: Bạn không mất bài đã đánh mà được quyền đoán lại hoặc chọn hành động khác.

---

## 6. PVE BOT LOGIC SYSTEM (HỆ THỐNG TRÍ TUỆ NHÂN TẠO PVE)

### Cấp độ 1: Dễ (EasyBot)
- Đưa ra quyết định ngẫu nhiên dựa trên xác suất (50% đánh ngẫu nhiên 1 lá chức năng bất kỳ trên tay, 50% bỏ qua để rút bài).
- Nếu gặp bom và có Defuse, sẽ chèn bom ở vị trí ngẫu nhiên hoặc đặt ngay trên đầu (`index = 0`).

### Cấp độ 2: Trung bình (MediumBot)
- Sử dụng các quy tắc logic cứng (Rule-based):
  - Nếu đang bị Attack (`turnsToPlay > 1`), ưu tiên đánh `Skip` hoặc `Attack` trên tay để né lượt.
  - Nếu xấp bài rút còn ít bài (`DrawPile <= 10`), ưu tiên sử dụng `See The Future` hoặc `Shuffle` để thám thính và đổi vị trí bom.
  - Khi chèn bom bằng Defuse, sẽ cố tình gài bẫy đặt ở các vị trí `index = 1` hoặc `index = 2` để hạ gục người chơi kế tiếp.

### Cấp độ 3: Khó (AIBot) - Não AI Kết nối Google Gemini API
Model này được trang bị trí tuệ nhân tạo linh hoạt, có thể tính toán chiến thuật, lừa đối thủ và đưa ra các nước đi thông minh thông qua việc tích hợp trực tiếp API của Google Gemini.

#### A. Cách Thức Giao Tiếp & Kết Nối API:
- **Phương thức:** Sử dụng hàm `fetch` tích hợp sẵn (Native Global Fetch) của Node.js (phiên bản v18 trở lên) để gửi request dạng `POST` trực tiếp đến API mà không cần cài thêm thư viện ngoài (như Axios hay SDK).
- **Cơ chế xác thực bảo mật:** API Key được nạp an toàn từ biến môi trường `process.env.GEMINI_API_KEY` trong file cấu hình `.env` của backend. Key được gửi qua HTTP Header dưới tham số `'x-goog-api-key'` thay vì truyền trực tiếp trên URL nhằm nâng cao bảo mật và tránh bị Google chặn truy cập do để lộ key ở URL.
- **Endpoint API:** `https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent`

#### B. Cơ chế Tự Động Dự Phòng (Resilient Fallback Mechanism):
Để tránh lỗi gián đoạn do giới hạn lượt gọi miễn phí (HTTP 429 - Quota Exceeded) trên từng dòng model cụ thể, hệ thống backend sử dụng cơ chế xoay vòng dự phòng:
1. **Lượt thử 1:** Gọi model nhẹ và tối ưu nhất là `gemini-2.5-flash-lite`.
2. **Lượt thử 2 (Dự phòng 1):** Nếu lỗi, hệ thống tự động gọi model thông minh hơn là `gemini-3.5-flash`.
3. **Lượt thử 3 (Dự phòng 2):** Tiếp tục gọi model tiêu chuẩn `gemini-2.5-flash`.
*Nếu toàn bộ chuỗi fallback thất bại, hệ thống sẽ ghi log cảnh báo và có thể đưa ra nước đi an toàn mặc định cho Bot để game không bị treo.*

#### C. Định Dạng Dữ Liệu Input & Output:
Hệ thống sử dụng tính năng **Structured JSON Output** của Gemini để ép kiểu dữ liệu trả về đúng định dạng mong muốn:
- **Input (Prompt):** Hệ thống backend đóng gói chi tiết trạng thái bàn chơi hiện tại (Mô tả số người còn sống, số lượng bài trong xấp rút, thứ tự lượt đi, các hành động vừa diễn ra) cùng toàn bộ bài trong tay Bot dưới dạng JSON để gửi lên AI.
- **Output (Response Schema):** AI bắt buộc phải trả về một JSON Object có cấu trúc định sẵn như sau:
  ```json
  {
    "action": "DRAW_CARD" | "PLAY_CARDS" | "DEFUSE",
    "cardIds": ["Mảng chứa ID của các lá bài muốn đánh, để trống nếu Draw"],
    "targetId": "ID của đối thủ muốn nhắm tới (nếu chơi lá Favor hoặc chơi Cặp bài)",
    "insertIndex": 0, // Vị trí muốn đặt bom (0 là đỉnh xấp bài) nếu action là DEFUSE
    "requestedCardType": "Tên loại bài muốn đòi nếu chơi bộ 3 lá",
    "reasoning": "Chuỗi văn bản giải thích ngắn gọn tư duy chiến thuật của AI cho nước đi này"
  }
  ```
  Nhờ cấu trúc JSON cứng này, backend có thể dễ dàng giải mã và thực thi các hành động của AI Bot một cách chính xác mà không gặp lỗi phân tích văn bản.