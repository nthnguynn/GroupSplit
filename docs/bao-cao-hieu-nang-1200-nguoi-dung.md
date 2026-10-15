# Báo cáo tối ưu hiệu năng GroupSplit — mục tiêu 1.200 người dùng đồng thời

Ngày đo: 14/10/2026  
Phiên bản ứng dụng: Next.js 16.2.10, Node.js 24.19.0, Bun 1.4.2, PostgreSQL 17.11

## 1. Kết luận

Ứng dụng đạt mục tiêu **1.200 người dùng đang hoạt động đồng thời** trên tầng ứng dụng với 4 Next.js worker, theo tiêu chí:

- p99 không quá 1.000 ms;
- tỷ lệ lỗi không quá 1%;
- mỗi người dùng mở trung bình một trang sau mỗi 5–15 giây;
- tỷ lệ hành vi: trang nhóm 40%, dashboard 30%, API thông báo 20%, danh sách nhóm 10%.

Mốc 1.200 được chạy lại hai lần độc lập:

| Lần đo | Người dùng | Request/giây | p50 | p95 | p99 | Lỗi | Kết quả |
|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 1.200 | 118,0 | 75 ms | 378 ms | 615 ms | 0% | Đạt |
| 2 | 1.200 | 115,2 | 100 ms | 452 ms | 820 ms | 0% | Đạt |

Kết quả chi tiết:

- `scripts/bench/results/users-2026-10-14T10-00-41-347Z.json`
- `scripts/bench/results/users-2026-10-14T10-01-37-158Z.json`

Ứng dụng **chưa đạt** mục tiêu khắc nghiệt hơn là **1.200 người cùng bấm tại đúng một thời điểm** với p99 không quá 1 giây. Ma trận burst gồm bảy kịch bản đều trả về thành công ở tầng HTTP, nhưng p99 nằm trong khoảng 1.995–15.356 ms. Kịch bản cùng duyệt một hóa đơn còn phát hiện lỗi nghiệp vụ: 1.200 request đều được xử lý và tạo ít nhất 30 thông báo trùng trong 30 thông báo mới nhất.

Vì vậy cần công bố hai capacity riêng:

- **1.200 người online, có thời gian đọc 5–15 giây:** đạt;
- **1.200 thao tác đồng thời trong một burst:** chưa đạt SLA 1 giây.

## 2. Phạm vi của con số 1.200

Kết quả 615–820 ms là capacity của workload đọc mô phỏng người dùng thật, không phải 1.200 request được phát cùng một mili-giây. Với thời gian đọc 5–15 giây, 1.200 người tạo khoảng 115–118 request/giây.

Harness tải HTML/API sau khi đăng nhập, nhưng không chạy JavaScript trong trình duyệt. Vì vậy phép đo không bao gồm:

- hydration và render phía máy người dùng;
- tải asset tĩnh đã cache;
- 1.200 kết nối SSE lâu dài của tính năng realtime;
- tải ghi lớn như đồng thời tạo/sửa hóa đơn;
- TLS, nén và giới hạn mạng của reverse proxy production.

Một burst 1.200 request tạo hàng đợi tức thời lớn hơn nhiều. Phép đo mới bao phủ đọc SSR/API, tạo hóa đơn, góp quỹ, báo đã chuyển tiền, đánh dấu thông báo và tranh chấp duyệt cùng một hóa đơn. Trước khi công bố SLA production, cần chạy lại cả hai loại workload qua domain HTTPS thật bằng biến `BASE_URL`.

## 3. Môi trường đo

| Thành phần | Cấu hình |
|---|---|
| CPU máy đo | Intel Xeon E5-2676 v3, 12 core / 24 logical processor |
| RAM | 47,8 GB |
| App worker | Cố định 4 worker bằng `WEB_CONCURRENCY=4` |
| DB | PostgreSQL 17.11 |
| Dữ liệu | 10 tài khoản, 300 hóa đơn rải trong 90 ngày, khoảng 1% chờ duyệt |
| Load generator | Chạy cùng máy với app và DB |
| Cửa sổ đo | 30 giây sau 15 giây warm-up |

Việc load generator chạy cùng máy làm số đo thận trọng hơn về CPU, nhưng môi trường production vẫn có thể khác về latency DB, proxy và giới hạn container.

## 4. Baseline và kết quả sau tối ưu

### 4.1. Vòng lặp kiểm thử chính

Lệnh chuẩn:

```powershell
$env:WEB_CONCURRENCY = "4"
bun run bench:server
```

Ở terminal khác:

```powershell
$env:STAGES = "1200"
$env:HOLD = "30"
bun run bench:users
```

Baseline ngay trước tối ưu nén:

| Người dùng | Request/giây | p50 | p95 | p99 | Lỗi | Kết quả |
|---:|---:|---:|---:|---:|---:|---|
| 1.200 | 108,9 | 219 ms | 1.877 ms | 2.966 ms | 0% | Không đạt |

Sau tối ưu nén, p99 giảm còn 615–820 ms và throughput tăng lên 115–118 request/giây.

### 4.2. Route nặng

| Route | Trước | Sau | Thay đổi chính |
|---|---:|---:|---|
| Trang nhóm, 16 kết nối | ~21 req/s, p99 ~835 ms | ~84 req/s, p99 ~278 ms | Chỉ render section đang mở |
| Dashboard, 16 kết nối | ~26 req/s, p99 ~688 ms | ~118 req/s, p99 ~218 ms | Giảm SSR danh sách và chạy query song song |

Kích thước HTML/RSC giải nén:

- trang nhóm mặc định: khoảng 281 KB xuống 232 KB;
- dashboard: khoảng 249 KB xuống 154 KB.

### 4.3. Burst 1.200 thao tác cùng thời điểm

Mỗi kịch bản thả toàn bộ 1.200 request qua cùng một barrier, không rải thời gian bắt đầu và không có think time:

| Kịch bản | p50 | p95 | p99 | Lỗi HTTP | Kết quả SLA 1 giây |
|---|---:|---:|---:|---:|---|
| Cùng mở tab Chi tiêu | 10.593 ms | 15.071 ms | 15.356 ms | 0% | Không đạt |
| Hỗn hợp toàn bộ màn hình đọc | 6.001 ms | 9.490 ms | 9.671 ms | 0% | Không đạt |
| Cùng bấm Thêm hóa đơn | 2.649 ms | 4.416 ms | 4.648 ms | 0% | Không đạt |
| Cùng bấm Góp quỹ | 3.162 ms | 3.591 ms | 3.664 ms | 0% | Không đạt |
| Cùng bấm Đã chuyển tiền | 2.752 ms | 2.987 ms | 3.001 ms | 0% | Không đạt |
| Cùng bấm Đánh dấu đã đọc | 1.747 ms | 1.988 ms | 1.995 ms | 0% | Không đạt |
| Cùng duyệt một hóa đơn | 6.376 ms | 6.775 ms | 6.821 ms | 0% | Không đạt, sai tính đúng |

Kết quả chi tiết: `scripts/bench/results/scenarios-2026-10-14T14-05-34-909Z.json`.

Không có lỗi HTTP cho thấy app và PostgreSQL không sập. Tuy nhiên, SLA độ trễ một giây không đạt vì request xếp hàng. Đây là kết quả local khi app, PostgreSQL và load generator dùng chung máy; cần đo lại từ một máy phát tải riêng để có số production chính xác.

Kịch bản duyệt cùng một hóa đơn còn không idempotent: 1.200 request đều trả `200`, cùng chạy lại phần tạo thông báo. Harness quan sát 30 thông báo trùng trong giới hạn 30 bản ghi mới nhất, nên số trùng thực tế có thể cao hơn. Route này cần chuyển trạng thái `PENDING -> APPROVED/REJECTED` bằng điều kiện nguyên tử và chỉ phát side effect cho request thắng.

## 5. Các tối ưu đã áp dụng

### 5.1. Chạy đúng mô hình cluster của Portainer

`next start` chỉ dùng một tiến trình. Benchmark mặc định đã được đổi sang `server.mjs`, sử dụng nhiều worker giống container production.

- `bun run bench:server`: cluster production;
- `bun run bench:server:single`: baseline một tiến trình;
- `WEB_CONCURRENCY`: số worker;
- `DB_CONNECTION_BUDGET`: ngân sách connection PostgreSQL chia cho các worker.

### 5.2. Chỉ SSR section đang mở trên trang nhóm

Trước đây sáu tab đều được dựng thành React tree và serialize xuống client trong cùng request, dù người dùng chỉ nhìn một tab.

Sau tối ưu:

- URL giữ section hiện tại qua tham số `tab`;
- server chỉ render component của section đang mở;
- chuyển section vẫn dùng client-side navigation của Next.js;
- không thay đổi dữ liệu hay quyền truy cập.

Đây là thay đổi có tác động lớn nhất đến route trang nhóm.

### 5.3. Giảm SSR trên dashboard

Dashboard vẫn truy vấn toàn bộ giao dịch trong khoảng ngày để tính:

- tổng chi tiêu;
- trung bình ngày;
- biểu đồ theo thời gian;
- phân bổ theo nhóm và danh mục.

Phần lịch sử cuộn chỉ render 20 giao dịch gần nhất. Lịch sử đầy đủ vẫn có trong trang nhóm. Query số dư nhóm được khởi chạy song song với query chi tiêu để loại bỏ waterfall.

### 5.4. Giao nén HTTP cho reverse proxy

Next.js mặc định gzip từng phản hồi trong worker. Với phản hồi SSR lớn, nén tiêu tốn đáng kể CPU của bốn worker và tạo hàng đợi khi tải cao.

`next.config.ts` đặt `compress: false`; Nginx Proxy Manager, Nginx hoặc Traefik phải đảm nhận gzip/Brotli.

Điều kiện bắt buộc sau triển khai:

```bash
curl -sI -H "Accept-Encoding: br,gzip" https://TEN-MIEN/login
```

Phản hồi phải có một trong các header:

```text
Content-Encoding: br
Content-Encoding: gzip
```

Nếu proxy không nén, không nên giữ `compress: false`, vì băng thông và thời gian tải qua Internet sẽ tăng.

### 5.5. Sửa độ chính xác của benchmark

Harness cũ đọc biến stage khi request kết thúc, nên request chậm có thể bị rơi khỏi stage hoặc lọt sang stage tiếp theo. Harness mới:

- gắn request vào stage tại thời điểm bắt đầu;
- chờ mọi request trong cửa sổ đo hoàn tất;
- không làm đẹp giả p95/p99 khi server nghẽn;
- sắp xếp và loại trùng danh sách stage.

### 5.6. Bổ sung harness burst và kiểm tra tính đúng

`scripts/bench/scenario-test.mjs` kiểm tra riêng tải dồn cùng thời điểm. Harness dùng barrier chung để phát request, đo p50/p95/p99, thống kê HTTP status và kiểm tra số thông báo sinh ra khi nhiều request cùng duyệt một hóa đơn.

Các kịch bản ghi chỉ chạy trên nhóm `[BENCH]`. Sau khi đo, chạy lại `bench:seed` để xóa dữ liệu burst và đưa bộ dữ liệu về trạng thái chuẩn.

## 6. Cách tái hiện bài test

### Bước 1 — tạo dữ liệu gần thực tế

```powershell
$env:BENCH_EXPENSES = "300"
$env:BENCH_DAYS = "90"
$env:BENCH_PENDING_EVERY = "100"
bun run bench:seed
```

Lệnh seed xóa nhóm `[BENCH]` cũ và tạo lại. Không chạy trên database production có dữ liệu benchmark cần giữ.

### Bước 2 — build production

```powershell
bun run build
```

Không đo bằng `next dev`.

### Bước 3 — khởi động app cluster

```powershell
$env:WEB_CONCURRENCY = "4"
$env:DB_CONNECTION_BUDGET = "80"
bun run bench:server
```

### Bước 4 — chạy bài test 1.200 người

Ở terminal khác:

```powershell
$env:BASE_URL = "http://localhost:3005"
$env:STAGES = "1200"
$env:HOLD = "30"
$env:THINK_MIN = "5"
$env:THINK_MAX = "15"
$env:MAX_P99 = "1000"
$env:MAX_ERR = "1"
bun run bench:users
```

Đạt khi dòng kết quả có `p99 <= 1000ms`, `Lỗi % <= 1` và ký hiệu `✓ đạt`.

Nên chạy tối thiểu hai lần. Để kiểm tra ngưỡng cao hơn:

```powershell
$env:STAGES = "1200,1300,1400"
$env:HOLD = "30"
bun run bench:users
```

### Bước 5 — cô lập từng endpoint

```powershell
$env:STAGES = "4,8,16,32"
$env:DURATION = "10"
$env:ONLY = "api-groups,api-notifications,dashboard,group-page"
bun run bench
```

Test này dùng connection liên tục, khắc nghiệt hơn mô hình người dùng có thời gian đọc. Nó phù hợp để tìm route gây nghẽn, không dùng trực tiếp để quy đổi thành số người dùng.

### Bước 6 — chạy toàn bộ kịch bản burst

```powershell
$env:BASE_URL = "http://localhost:3005"
$env:USERS = "1200"
$env:WRITE_USERS = "1200"
$env:MAX_P99 = "1000"
$env:MAX_ERR = "1"
bun run bench:scenarios
```

Để tái hiện nhanh lỗi nhiều người cùng duyệt một hóa đơn:

```powershell
$env:ONLY = "approve-one"
$env:USERS = "20"
bun run bench:scenarios
```

Lệnh này phải có khả năng báo lỗi nếu sinh nhiều hơn một thông báo cho cùng hóa đơn. Sau khi test ghi, chạy lại `bun run bench:seed` để dọn dữ liệu benchmark.

### Bước 7 — test qua domain production

```powershell
$env:BASE_URL = "https://TEN-MIEN"
$env:STAGES = "1200"
$env:HOLD = "60"
bun run bench:users
```

Nên chạy ngoài giờ cao điểm vì đây là tải thật lên app, proxy và PostgreSQL production.

## 7. Cấu hình Portainer khuyến nghị

- Đặt `WEB_CONCURRENCY` bằng số CPU thực sự cấp cho container app; bắt đầu từ 4.
- Giữ `DB_CONNECTION_BUDGET=80` khi PostgreSQL có `max_connections=100`, chừa connection cho migration, admin và monitoring.
- Bật gzip hoặc Brotli ở reverse proxy.
- Theo dõi CPU app, CPU DB, memory, active DB connections và p99 trong lúc test.
- Không tăng worker vô hạn: mỗi worker có pool DB và memory riêng.
- Nếu 1.200 người vẫn không đạt qua domain thật, tăng CPU/replica sau khi xác nhận proxy và DB chưa là nút thắt.

## 8. Tiêu chí nghiệm thu production

Chỉ coi mục tiêu 1.200 hoàn tất trên production khi cả ba điều kiện cùng đạt:

1. Hai lần test liên tiếp qua domain HTTPS có p99 ≤ 1 giây và lỗi ≤ 1%.
2. Reverse proxy trả `Content-Encoding: br` hoặc `gzip`.
3. PostgreSQL không chạm `max_connections`, container không bị throttling CPU hoặc OOM.

Nếu yêu cầu nghiệp vụ là **1.200 người cùng bấm một nút trong cùng thời điểm**, cần thêm bốn điều kiện:

1. p99 của từng burst không quá ngưỡng riêng đã thống nhất; hiện tại chưa đạt ngưỡng 1 giây.
2. Route ghi có idempotency hoặc chuyển trạng thái nguyên tử; một hành động logic chỉ sinh side effect một lần.
3. Load generator chạy trên máy riêng, không tranh CPU/RAM/IO với app và PostgreSQL.
4. Kiểm thử lại qua reverse proxy thật, đồng thời quan sát pool DB, CPU throttling và hàng đợi request.

