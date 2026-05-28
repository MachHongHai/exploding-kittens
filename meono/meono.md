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

## 4. DECK MEMORY SYSTEM (HỆ THỐNG GHI NHỚ ĐỈNH BÀI)
Để Bot có thể đưa ra quyết định thông minh như con người, hệ thống lưu trữ trạng thái bộ nhớ `knownDeckTop` dạng mảng cho mỗi người chơi (Player). Bộ nhớ này ghi nhận thông tin bài khi được hé lộ và tự động cập nhật theo các sự kiện trên bàn chơi:
* **Sự kiện See The Future:** Khi bất kỳ người chơi nào chơi lá này, `knownDeckTop` của họ sẽ được nạp chính xác thông tin (loại bài, tên bài) của 3 lá trên cùng của xấp rút (từ đỉnh bài xuống dưới).
* **Sự kiện Rút bài (Draw):** Khi bất kỳ ai rút một lá từ xấp bài, `knownDeckTop` của tất cả người chơi sẽ tự động dịch chuyển (`shift`) bớt 1 phần tử đầu tiên, do lá bài cũ đã rời khỏi đỉnh xấp bài.
* **Sự kiện Xáo bài (Shuffle):** Khi lá Shuffle được sử dụng, bộ nhớ `knownDeckTop` của tất cả người chơi lập tức bị xóa sạch (`[]`) vì các vị trí bài đã thay đổi hoàn toàn.
* **Sự kiện Tháo ngòi (Defuse):** Khi quả bom được gài lại vào xấp bài tại vị trí `insertIndex = pos`:
  - **Người gài bom:** Tự động chèn (`splice`) phần tử `EXPLODING_KITTEN` vào mảng `knownDeckTop` của mình tại vị trí tương ứng. Họ ghi nhớ chính xác bom nằm ở đâu.
  - **Những người chơi khác:** Bị xóa sạch `knownDeckTop` vì vị trí bài của họ đã bị dịch chuyển/xáo trộn không còn chính xác.

---

## 5. PVE BOT LOGIC SYSTEM (HỆ THỐNG TRÍ TUỆ NHÂN TẠO PVE)

### Cấp độ 1: Dễ (EasyBot)
- Đưa ra quyết định ngẫu nhiên dựa trên xác suất (50% đánh ngẫu nhiên 1 lá chức năng bất kỳ trên tay, 50% bỏ qua để rút bài).
- Nếu gặp bom và có Defuse, sẽ chèn bom ở vị trí ngẫu nhiên hoặc đặt ngay trên đầu (`index = 0`).

### Cấp độ 2: Trung bình (MediumBot)
Sử dụng các quy tắc logic cứng (Rule-based) cải tiến kết hợp với hệ thống ghi nhớ đỉnh bài:
* **Né bom bằng bộ nhớ:** Bot kiểm tra bộ nhớ `knownDeckTop`. Nếu phát hiện có bom `EXPLODING_KITTEN` nằm trong phạm vi số lượt mình bắt buộc phải rút (`turnsToPlay`), Bot sẽ ưu tiên đánh ngay các lá phòng thủ (`Skip`, `Attack`) hoặc lá xáo bài (`Shuffle`) để tránh bị nổ.
* **Giữ bài phòng thủ:** Nếu bộ nhớ báo hiệu lá trên cùng là an toàn (không có bom), Bot sẽ không bao giờ lãng phí các quân bài phòng thủ (`Skip`, `Attack`, `Shuffle`), mà chọn rút bài ngay.
* **Gài bom dựa trên Defuse của đối thủ:** Khi tháo ngòi (`DEFUSE`), Bot sẽ kiểm tra người chơi hoạt động tiếp theo có lá Defuse hay không.
  - Nếu đối thủ kế tiếp **không có Defuse**, Bot đặt bom ngay trên cùng (`insertIndex = 0`) để loại đối thủ ngay lập tức.
  - Nếu đối thủ có Defuse, Bot sẽ đặt sâu hơn (ngẫu nhiên ở index từ 1 đến 3) để trì hoãn rủi ro cho bản thân.

### Cấp độ 3: Khó (AIBot) - Não AI Kết nối Google Gemini API
Model Hard này được tích hợp trực tiếp API của Google Gemini để xử lý các nước đi chiến thuật phức tạp nhất.

#### A. Cách Thức Giao Tiếp & Kết Nối API:
- **Phương thức:** Sử dụng hàm `fetch` tích hợp sẵn (Native Global Fetch) của Node.js (phiên bản v18 trở lên) để gửi request dạng `POST` trực tiếp đến API mà không cần cài thêm thư viện ngoài (như Axios hay SDK).
- **Cơ chế xác thực bảo mật:** API Key được nạp an toàn từ biến môi trường `process.env.GEMINI_API_KEY` trong file cấu hình `.env` của backend. Key được gửi qua HTTP Header dưới tham số `'x-goog-api-key'` thay vì truyền trực tiếp trên URL nhằm nâng cao bảo mật.
- **Endpoint API:** `https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent`

#### B. Cơ chế Tự Động Dự Phòng (Resilient Fallback Mechanism):
Để tránh lỗi gián đoạn do giới hạn lượt gọi miễn phí (HTTP 429 - Quota Exceeded) trên từng dòng model cụ thể, hệ thống backend sử dụng cơ chế xoay vòng dự phòng:
1. **Lượt thử 1:** Gọi model nhẹ và tối ưu nhất là `gemini-2.5-flash-lite`.
2. **Lượt thử 2 (Dự phòng 1):** Nếu lỗi, hệ thống tự động gọi model thông minh hơn là `gemini-3.5-flash`.
3. **Lượt thử 3 (Dự phòng 2):** Tiếp tục gọi model tiêu chuẩn `gemini-2.5-flash`.
*Nếu toàn bộ chuỗi fallback thất bại, hệ thống sẽ ghi log cảnh báo và tự động chuyển về logic của Bot Medium làm phương án dự phòng an toàn.*

#### C. Tối ưu hóa Quota (Lượt gọi API):
Để tiết kiệm tối đa hạn mức sử dụng (Quota):
- Nếu Bot **không bị bom** và trên tay **không có bất kỳ quân bài nào chơi được** (không có lá chức năng đơn, không có cặp bài trùng để cướp bài), Bot sẽ tự động thực hiện hành động rút bài (`DRAW_CARD`) ngay lập tức mà không cần gọi API Gemini.

#### D. Định Dạng Dữ Liệu Input & Output:
Hệ thống sử dụng tính năng **Structured JSON Output** của Gemini để ép kiểu dữ liệu trả về đúng định dạng mong muốn:
- **Input (Prompt & Game State):** Backend đóng gói trạng thái bàn chơi chi tiết gồm: số bài còn lại, số lượt đi của Bot, danh sách đối thủ kèm số bài trên tay, lượt đi của họ, **đặc biệt là đối thủ đó có lá Defuse hay không**, cùng danh sách các lá bài Bot đang ghi nhớ ở đỉnh bài (`knownDeckTop`).
- **Output (Response Schema):** AI bắt buộc phải trả về một JSON Object có cấu trúc định sẵn như sau:
  ```json
  {
    "action": "DRAW_CARD" | "PLAY_CARDS" | "DEFUSE",
    "cardIds": ["Mảng chứa ID của các lá bài muốn đánh, để trống nếu Draw"],
    "targetId": "ID của đối thủ muốn nhắm tới (nếu chơi lá Favor hoặc chơi Cặp bài)",
    "insertIndex": 0, // Vị trí muốn đặt bom (0 là đỉnh xấp bài) nếu action là DEFUSE
    "requestedCardType": "Tên loại bài muốn đòi nếu chơi bộ 3 lá",
    "reasoning": "Chuỗi văn bản giải thích tư duy chiến thuật của AI cho nước đi này"
  }
  ```
  AI được chỉ dẫn chi tiết:
  - Nếu biết có bom sắp tới: Ưu tiên đánh Skip, Attack, hoặc Shuffle.
  - Nếu biết đỉnh bài an toàn: Nhịn bài, thực hiện rút bài.
  - Khi Defuse: Đặt bom ở vị trí tối ưu để hại đối thủ (ví dụ đặt ở index 0 nếu người tiếp theo không có Defuse).