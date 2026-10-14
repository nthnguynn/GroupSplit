# Cách tạo webhook SePay

## Tạo webhook SePay qua form 4 bước trên Dashboard: chọn loại sự kiện, lọc theo tiền tố mã thanh toán, gửi thử, sửa và sao chép cấu hình.

Vào Dashboard → **Tích hợp** → **[Webhooks](https://my.sepay.vn/webhooks)** để tạo và quản lý webhook. Tạo webhook mới qua form 4 bước, còn các thao tác sửa, sao chép, gửi thử nằm trong menu **⋮** ở mỗi dòng.

<Image src="/images/webhooks/webhooks-page.png" alt="Trang Webhooks" caption="Trang quản lý Webhooks" />

## Form tạo 4 bước

Bấm **Thêm webhook**.

<Steps>
  <Step title="Bước 1: Cơ bản">
    * **Tên**: gợi nhớ, ví dụ "Thanh toán đơn hàng website"
    * **URL**: endpoint nhận webhook, phải HTTPS cho production
    * **Loại sự kiện**: xem [Loại sự kiện](#loai-su-kien) bên dưới
    * **Content-Type**: để mặc định `application/json` ([chi tiết](./tich-hop-webhook#content-type) nếu cần đổi)
    * **Tự động gửi lại**: bật nếu muốn SePay retry khi server trả lỗi. Chi tiết lịch retry: [Xử lý lỗi](./xu-ly-loi#lich-retry)

    <Image src="/images/webhooks/wizard-step-basic.png" alt="Bước 1: Cơ bản" caption="Điền thông tin cơ bản cho webhook" />
  </Step>

  <Step title="Bước 2: Tài khoản">
    Chọn tài khoản ngân hàng nào kích hoạt webhook.

    * **Tất cả tài khoản**: mọi tài khoản đều kích hoạt webhook, tài khoản ngân hàng mới liên kết sau cũng tự áp dụng mà không cần chỉnh lại.
    * **Chọn cụ thể**: chọn từng tài khoản, cấu hình VA riêng từng ngân hàng.

    Bạn cũng cấu hình bộ lọc mã thanh toán và "Bỏ qua giao dịch không có mã" tại bước này. Xem [Bộ lọc](#bo-loc) bên dưới.

    <Image src="/images/webhooks/wizard-step-accounts.png" alt="Bước 2: Tài khoản" caption="Chọn tài khoản ngân hàng và bộ lọc" />

    Chi tiết về tài khoản + VA: [Tài khoản ngân hàng](./tai-khoan-ngan-hang).
  </Step>

  <Step title="Bước 3: Bảo mật">
    Chọn cách SePay xác thực với endpoint của bạn:

    * **Không xác thực**: chỉ dùng khi test
    * **API Key**: header `Authorization: Apikey ...`
    * **HMAC-SHA256** (khuyến nghị): chữ ký trong header
    * **OAuth 2.0**: Bearer token qua token endpoint

    <Image src="/images/webhooks/wizard-step-security.png" alt="Bước 3: Bảo mật" caption="Chọn phương thức xác thực" />

    So sánh và code mẫu: [Xác thực](./xac-thuc).
  </Step>

  <Step title="Bước 4: Cảnh báo">
    * Bật/tắt cảnh báo
    * Ngưỡng lỗi liên tiếp trước khi gửi (1–20, mặc định 3)
    * Chọn kênh nhận: Telegram, Slack, Discord

    <Image src="/images/webhooks/wizard-step-alerts.png" alt="Bước 4: Cảnh báo" caption="Thiết lập cảnh báo lỗi" />

    Cấu hình kênh cảnh báo: [Giám sát](./giam-sat#canh-bao).
  </Step>
</Steps>

## Loại sự kiện

| Loại         | Gửi webhook khi              |
| ------------ | ---------------------------- |
| **Tiền vào** | Có tiền chuyển đến tài khoản |
| **Tiền ra**  | Có tiền chuyển đi            |
| **Cả hai**   | Có bất kỳ giao dịch nào      |

**Tiền ra** có hai điều kiện: chỉ hỗ trợ Sacombank, TPBank, VietinBank và phải dùng [TKP](./tai-khoan-ngan-hang#hai-loai-va) (VA nội dung, không dùng được VA chính thức). Xem [Lưu ý khi chọn Chỉ tiền ra](./tai-khoan-ngan-hang#luu-y-khi-chon-chi-tien-ra).

<Callout type="tip">
Với webhook xác thực thanh toán, thường chỉ cần chọn 
Tiền vào
.
</Callout>

## Bộ lọc

### Lọc theo tiền tố mã thanh toán

Yêu cầu SePay chỉ gửi webhook khi mã thanh toán bắt đầu bằng tiền tố nhất định.

Ví dụ: khách chuyển khoản nội dung `GCDONHANG001`. SePay nhận diện được mã `GCDONHANG001`. Webhook cấu hình tiền tố `GC` → mã bắt đầu bằng `GC` → gửi.

| Tiền tố       | Mã thanh toán     | Kết quả            |
| ------------- | ----------------- | ------------------ |
| `GC`          | `GCDONHANG001`    | Gửi                |
| `GC`          | `ORDERDONHANG001` | Bỏ qua             |
| `GC`, `ORDER` | `ORDERDONHANG001` | Gửi (khớp `ORDER`) |
| (không chọn)  | Bất kỳ            | Gửi hết            |

Trước hết cần cấu hình cấu trúc mã tại **Công ty → Cấu hình chung → Cấu trúc mã thanh toán**. Sau đó ở bước Tài khoản khi tạo webhook sẽ có mục chọn tiền tố.

<Image src="/images/webhooks/wizard-prefix-filter.png" alt="Bộ lọc tiền tố" caption="Chọn tiền tố mã thanh toán khi tạo webhook" />

<Callout type="info">
Tiền tố phân biệt hoa thường, ví dụ 
`GC`
 và 
`gc`
 được tính là hai tiền tố khác nhau.
</Callout>

### Bỏ qua giao dịch không có mã

Bật thì SePay chỉ gửi webhook cho giao dịch có mã thanh toán. Giao dịch nội dung trống hoặc không khớp cấu trúc sẽ bị bỏ qua.

### Thứ tự kiểm tra

Khi có giao dịch mới, SePay kiểm tra lần lượt:

1. Giao dịch có thuộc tài khoản đã cấu hình?
2. Nếu có cấu hình VA, giao dịch có khớp VA nào?
3. Loại sự kiện (tiền vào/ra) có đúng?
4. Giao dịch có mã thanh toán không? (nếu bật bỏ qua)
5. Mã có bắt đầu bằng tiền tố đã chọn?

Webhook chỉ được gửi khi tất cả điều kiện ở trên đều khớp.

## Gửi thử

Bấm **⋮** → **Gửi thử** để kiểm tra endpoint trước khi có giao dịch thật. SePay gửi payload mẫu đến URL và hiển thị kết quả (HTTP status và response body) ngay.

<Image src="/images/webhooks/test-send-result.png" alt="Kết quả Gửi thử" caption="Dialog kết quả Gửi thử với HTTP status và response body" />

<Callout type="info" title="Payload Gửi thử ≠ payload thật">
Cấu trúc JSON giống hệt, nhưng 
`id`
 là số mock (thường 
`0`
), các trường khác là data mẫu. Đừng viết cứng giá trị test vào code. Sau khi gửi thử thành công, vẫn nên thử lại với giao dịch thật (chuyển số nhỏ vào tài khoản).
</Callout>

## Quản lý webhook

<AccordionGroup>
  <Accordion title="Sửa webhook">
    Menu **⋮** → **Sửa**. Form 4 bước mở lại với dữ liệu hiện tại để bạn cập nhật.
  </Accordion>

  <Accordion title="Bật / Tắt webhook">
    Toggle trên hàng webhook (có xác nhận trước khi đổi trạng thái). Webhook tắt sẽ không nhận giao dịch nào đến khi bạn bật lại.
  </Accordion>

  <Accordion title="Xóa webhook">
    Menu **⋮** → **Xóa**. Thao tác không hoàn tác được. Lịch sử gửi cũ vẫn được giữ lại để đối soát.
  </Accordion>

  <Accordion title="Sao chép webhook">
    Menu **⋮** → **Sao chép** tạo một webhook mới y hệt cấu hình hiện tại (URL, tài khoản, bộ lọc, xác thực, cảnh báo). Riêng Secret key không được sao chép, bạn cần nhập lại. Tiện khi cần tạo nhiều webhook tương tự, ví dụ một bản cho `dev` và một bản cho `prod`.
  </Accordion>
</AccordionGroup>

## Tiếp theo

* [Tích hợp webhook](./tich-hop-webhook): cấu trúc payload, phản hồi hợp lệ, chống trùng lặp
* [Xác thực](./xac-thuc): HMAC-SHA256, API Key, OAuth 2.0
* [Tài khoản ngân hàng](./tai-khoan-ngan-hang): danh sách ngân hàng hỗ trợ + VA