# Cách tích hợp webhook SePay vào server

## Tích hợp webhook SePay vào server: cấu trúc payload, phản hồi hợp lệ, chống trùng lặp giao dịch và code mẫu đầy đủ bằng PHP và Node.js.

<Callout type="info" title="Cần test trước?">
Dùng 
Test mode
 để thử webhook bằng giao dịch mô phỏng mà không ảnh hưởng dữ liệu thật.
</Callout>

Mỗi khi có giao dịch, endpoint (URL nhận webhook) của bạn nhận một HTTP POST từ SePay. Trả về HTTP 200 kèm body `{"success": true}` trong vòng 30 giây là kết thúc. Nếu thất bại, SePay tự gửi lại theo [lịch retry](./xu-ly-loi#lich-retry).

## Payload

#### Các bước tích hợp WebHooks

Mỗi khi có giao dịch khớp với cấu hình webhook, SePay sẽ gửi HTTP POST đến endpoint của bạn:

<Response title="JSON">
```json
{
  "id": 92704,
  "gateway": "Vietcombank",
  "transactionDate": "2024-07-02 11:08:33",
  "accountNumber": "1017588888",
  "subAccount": "",
  "code": "SEVN63DC8E5C",
  "content": "SEVN63DC8E5C chuyen tien",
  "transferType": "in",
  "description": "NGUYEN VAN A chuyen tien",
  "transferAmount": 5000000,
  "accumulated": 105000000,
  "referenceCode": "FT24012345678"
}
```
</Response>

| Trường            | Kiểu    | Null / rỗng?  | Ghi chú                                                                                                                                                                                                                        |
| ----------------- | ------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | integer | không         | ID giao dịch trên SePay. Giá trị này không đổi qua mọi lần retry và replay, dùng làm khóa chống trùng.                                                                                                                         |
| `gateway`         | string  | không         | Tên ngân hàng của giao dịch (ví dụ `Vietcombank`, `BIDV`, `TPBank`).                                                                                                                                                           |
| `transactionDate` | string  | không         | Định dạng `YYYY-MM-DD HH:mm:ss`, giờ Việt Nam.                                                                                                                                                                                 |
| `accountNumber`   | string  | không         | Số tài khoản ngân hàng.                                                                                                                                                                                                        |
| `subAccount`      | string  | có thể rỗng   | VA khớp giao dịch. **VA chính thức**: số VA khách chuyển vào. **TKP** (VA nội dung): mã định danh trong nội dung chuyển khoản. Rỗng `""` nếu không khớp.                                                                       |
| `code`            | string  | có thể `null` | Mã thanh toán (ví dụ `DH123456`), trích từ nội dung theo tiền tố ở **Công ty → [Cấu hình chung](https://my.sepay.vn/company/configuration) → Cấu trúc mã thanh toán**. Không liên quan VA. `null` khi không khớp cấu hình nào. |
| `content`         | string  | không         | Nội dung chuyển khoản gốc từ ngân hàng, SePay không qua xử lý.                                                                                                                                                                 |
| `transferType`    | string  | không         | `in` (tiền vào) hoặc `out` (tiền ra).                                                                                                                                                                                          |
| `description`     | string  | có thể rỗng   | Mô tả đầy đủ từ ngân hàng. Một số ngân hàng không hỗ trợ, khi đó rỗng.                                                                                                                                                         |
| `transferAmount`  | integer | không         | Số tiền giao dịch, đơn vị VNĐ, luôn dương.                                                                                                                                                                                     |
| `accumulated`     | integer | có thể `0`    | Số dư sau giao dịch. Một số ngân hàng không hỗ trợ trả số dư, khi đó là `0`.                                                                                                                                                   |
| `referenceCode`   | string  | có thể rỗng   | Mã tham chiếu từ ngân hàng.                                                                                                                                                                                                    |

<Callout type="tip" title="Phân biệt null với chuỗi rỗng">
`code = null`
 nghĩa là không có mã thanh toán, khác với mã rỗng. Cả 
`null`
 và 
`""`
 đều falsy trong PHP/JS, nếu cần phân biệt thì dùng 
`$code === null`
 thay vì 
`if ($code)`
.
</Callout>

## Phản hồi hợp lệ

SePay chỉ tính là thành công khi phản hồi đủ 3 điều:

1. HTTP status **200** hoặc **201**.
2. Body là JSON có `success: true`, đúng y nguyên dạng `{"success": true}`.
3. Hoàn tất trong **30 giây**.

Sai một trong ba điều trên là tính thất bại, kể cả khi server bạn đã nhận được request:

| Phản hồi                                                      | SePay hiểu là       |
| ------------------------------------------------------------- | ------------------- |
| `200` hoặc `201` + `{"success": true}`                        | Thành công          |
| `200` + body khác (ví dụ `{"status": "ok"}` hoặc rỗng)        | Thất bại (sai body) |
| Status khác `200`/`201` (kể cả `202`, redirect, `4xx`, `5xx`) | Thất bại            |
| Không trả trong 30s                                           | Timeout             |

<Callout type="tip" title="200 chỉ có nghĩa là đã nhận">
Trả 200 ngay rồi đẩy xử lý sang queue hoặc background job. SePay chỉ cần biết endpoint đã nhận request. Xử lý đồng bộ chờ lâu dễ timeout, không nên.
</Callout>

## Content-Type

| Giá trị                             | Cách đọc                                |
| ----------------------------------- | --------------------------------------- |
| `application/json` (mặc định)       | `json_decode($body)` hoặc `req.body`    |
| `multipart/form-data`               | `$_POST['field']` hoặc `req.body.field` |
| `application/x-www-form-urlencoded` | `parse_str()` hoặc form parser          |

## Chống trùng lặp

Cùng một giao dịch có thể gửi webhook nhiều lần do:

* **Retry tự động** khi endpoint trả lỗi (xem [Xử lý lỗi](./xu-ly-loi#lich-retry))
* **Gửi lại thủ công** từ trang quản lý webhook. Admin có thể replay cả log đã thành công
* **Nhiều webhook trỏ về cùng endpoint** trong cùng một công ty

Đặt `transaction_id` là cột `UNIQUE` rồi dùng `INSERT IGNORE`. Cách này chặn trùng ngay từ database, an toàn cả khi 2 webhook đến đồng thời:

<!-- No code tabs available -->

<Callout type="warn">
Nếu không kiểm tra trùng, bạn có thể cộng tiền hai lần hoặc xác nhận đơn hàng lặp lại. Endpoint không idempotent (an toàn khi gọi nhiều lần) thì chỉ một cú bấm replay cũng có thể tạo ra hàng loạt giao dịch giả.
</Callout>

## Code mẫu

Hướng dẫn đầy đủ sẵn cho production (schema, HMAC, idempotent, checklist production):

* [Lập trình webhook SePay với PHP](./lap-trinh-webhooks/lap-trinh-webhook): PHP 8 + PDO + MySQL
* [Lập trình webhook SePay với Node.js (Express)](./lap-trinh-webhooks/lap-trinh-webhook-nodejs): Express + mysql2

Laravel user có thể dùng package [sepayvn/laravel-sepay](https://github.com/sepayvn/laravel-sepay).

## Tiếp theo

* [Xác thực](./xac-thuc): HMAC-SHA256, API Key, OAuth 2.0
* [Bảo mật](./bao-mat): HTTPS, whitelist IP, chống replay, kiểm tra dữ liệu
* [Xử lý lỗi](./xu-ly-loi): lịch retry + chẩn đoán