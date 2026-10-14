# Lập trình webhook SePay với Node.js

## Dựng endpoint webhook SePay bằng Node.js + Express + mysql2 đạt chuẩn production: xác thực HMAC-SHA256, chống trùng race-safe với INSERT IGNORE.

Hướng dẫn đầy đủ để dựng một endpoint Node.js + Express nhận webhook SePay: xác thực HMAC-SHA256, chống trùng giao dịch an toàn khi đồng thời, lưu vào MySQL. Node 18+, ESM, mysql2.

## Yêu cầu

* Node.js 18.0+ (có `fetch` native, `node:crypto`)
* MySQL 5.7+ hoặc MariaDB 10.3+
* `express`, `mysql2`
* URL endpoint công khai (HTTPS cho production)

## 1. Tạo database

```sql
CREATE DATABASE sepay_webhook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE sepay_webhook;

CREATE TABLE transactions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    sepay_id        BIGINT NOT NULL UNIQUE,
    gateway         VARCHAR(100) NOT NULL,
    transaction_date DATETIME NOT NULL,
    account_number  VARCHAR(100),
    sub_account     VARCHAR(250),
    code            VARCHAR(250),
    amount_in       BIGINT NOT NULL DEFAULT 0,
    amount_out      BIGINT NOT NULL DEFAULT 0,
    accumulated     BIGINT NOT NULL DEFAULT 0,
    content         TEXT,
    reference_code  VARCHAR(255),
    body            JSON NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_account (account_number, transaction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Lý do:

* `sepay_id UNIQUE` (khoá duy nhất): khi webhook retry gửi cùng giao dịch, `INSERT IGNORE` sẽ lặng lẽ bỏ qua bản ghi trùng thay vì báo lỗi.
* `BIGINT` cho tiền: VND không có phần thập phân, `INT` max 2.1 tỷ sẽ tràn với đơn B2B.
* `body JSON`: lưu payload gốc để debug hoặc query sau.

## 2. Tạo webhook trên Dashboard

Dashboard → **[Webhooks](https://my.sepay.vn/webhooks)** → **Thêm**:

| Trường       | Giá trị                                 |
| ------------ | --------------------------------------- |
| Tên          | Webhook server Node                     |
| URL          | `https://your-server.com/webhook/sepay` |
| Loại sự kiện | Tiền vào (hoặc Cả hai)                  |
| Tài khoản    | Chọn tài khoản cần theo dõi             |
| Xác thực     | **HMAC-SHA256**                         |

Copy **Secret Key** (chỉ hiện đầy đủ 1 lần), lưu vào `.env`:

```bash
SEPAY_WEBHOOK_SECRET=<secret_key_của_bạn>
DB_HOST=localhost
DB_USER=db_user
DB_PASS=db_password
DB_NAME=sepay_webhook
```

## 3. Cài dependencies

```bash
npm init -y
npm install express mysql2 dotenv
```

Thêm `"type": "module"` vào `package.json` để kích hoạt ES modules (ESM), cho phép dùng cú pháp `import/export` thay vì `require`.

## 4. Endpoint Node.js

Tạo file `server.js`:

```js
import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const app = express();

const db = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Giữ raw body (không parse JSON) để tái tạo chữ ký HMAC.
// Dùng express.raw() cho /webhook/sepay, KHÔNG dùng express.json().
app.post(
  '/webhook/sepay',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    try {
      const body = req.body.toString('utf8');
      if (!body) {
        return res.status(400).json({ success: false, message: 'Empty body' });
      }

      // 1. Xác thực HMAC-SHA256
      const signature = req.headers['x-sepay-signature'] ?? '';
      const timestamp = Number(req.headers['x-sepay-timestamp'] ?? 0);
      const secret    = process.env.SEPAY_WEBHOOK_SECRET;

      // Chống replay: timestamp lệch quá 5 phút bị từ chối
      if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
        return res.status(401).json({ success: false, message: 'Request expired' });
      }

      const expected = 'sha256=' + crypto.createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const sig = Buffer.from(signature);
      const exp = Buffer.from(expected);
      if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }

      // 2. Parse JSON
      const data = JSON.parse(body);
      if (!data?.id) {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }

      // 3. Chống trùng giao dịch ở tầng database: INSERT IGNORE bỏ qua nếu sepay_id đã tồn tại
      const [result] = await db.execute(
        `INSERT IGNORE INTO transactions
         (sepay_id, gateway, transaction_date, account_number, sub_account,
          code, amount_in, amount_out, accumulated, content, reference_code, body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.gateway,
          data.transactionDate,
          data.accountNumber,
          data.subAccount ?? '',
          data.code,
          data.transferType === 'in'  ? data.transferAmount : 0,
          data.transferType === 'out' ? data.transferAmount : 0,
          data.accumulated ?? 0,
          data.content,
          data.referenceCode ?? '',
          body,
        ],
      );

      if (result.affectedRows === 0) {
        // Đã xử lý trước đó. Trả OK để SePay không retry.
        return res.json({ success: true });
      }

      // 4. Business logic: chỉ chạy khi giao dịch lần đầu được lưu (INSERT thành công)
      if (data.transferType === 'in' && data.code) {
        // Ví dụ: cập nhật đơn hàng
        await db.execute(
          `UPDATE orders SET status = 'paid', paid_at = NOW()
           WHERE code = ? AND status = 'pending' AND amount <= ?`,
          [data.code, data.transferAmount],
        );

        // TODO: enqueue job gửi email, cập nhật kho, etc.
      }

      res.json({ success: true });

    } catch (err) {
      console.error('SePay webhook error:', err);
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  }
);

// Health check cho monitor
app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(3000, () => console.log('Listening on :3000'));
```

<Callout type="warn" title="Raw body, không JSON parse">
HMAC-SHA256 ký trên bytes gốc. Dùng 
`express.raw({ type: '*/*' })`
 cho route 
`/webhook/sepay`
. KHÔNG dùng 
`app.use(express.json())`
 global vì nó parse body thành object rồi 
`JSON.stringify`
 lại sẽ lệch với bytes gốc (PHP escape Unicode 
`\uXXXX`
, JS thì không).
Nếu dùng Fastify, Hono, Koa: đọc docs framework tương ứng để lấy raw body.
</Callout>

## 5. Run + test

```bash
node server.js
```

Local test với ngrok (expose localhost 3000 ra Internet):

```bash
ngrok http 3000
# Copy URL https://xxx.ngrok-free.app/webhook/sepay vào webhook config
```

### Gửi thử từ Dashboard

Webhook → **⋮** → **Gửi thử**. Payload mẫu + kết quả HTTP hiện ngay.

### Giao dịch thật

Chuyển 10.000₫ vào tài khoản đã liên kết. Mở [Lịch sử gửi](https://my.sepay.vn/webhooks), check log mới nhất Status **Thành công**.

Query DB:

```sql
SELECT * FROM transactions ORDER BY id DESC LIMIT 5;
```

## 6. Checklist production

* [ ] URL HTTPS (Let's Encrypt miễn phí)
* [ ] Secret Key trong `.env`, `.env` gitignore, KHÔNG commit
* [ ] Process manager: PM2, systemd, hoặc Docker cho auto-restart
* [ ] Log errors vào file hoặc service (Sentry, Datadog)
* [ ] Whitelist [IP SePay](/vi/dia-chi-ip) ở firewall/WAF
* [ ] Cron [đối soát giao dịch](../doi-soat-giao-dich) 15-30 phút/lần
* [ ] Monitor via [Giám sát](../giam-sat) + cảnh báo Telegram/Slack/Discord
* [ ] Connection pool MySQL (`mysql.createPool` không phải `createConnection`)

## Tiếp theo

* [Tích hợp webhook](../tich-hop-webhook): payload schema, response contract đầy đủ
* [Xác thực](../xac-thuc): HMAC flow, code Python
* [Bảo mật](../bao-mat): checklist endpoint
* [PHP + MySQL](./lap-trinh-webhook): cùng tutorial bằng PHP