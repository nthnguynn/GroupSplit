/**
 * IP của client để làm khoá rate limit.
 *
 * X-Forwarded-For có dạng "<client tự gửi>, ..., <IP mà proxy gần app nhất nhìn thấy>":
 * các phần đầu client giả mạo được (đổi header mỗi request là lách được rate limit),
 * chỉ các phần cuối do proxy của mình ghi là tin được. Next.js chỉ tự đặt header này
 * (= IP socket) khi request không có sẵn, nên không có proxy thì vẫn ra IP thật.
 *
 * TRUSTED_PROXY_COUNT = số reverse proxy đứng trước app (mặc định 1, vd. Nginx Proxy Manager).
 * Đặt 2 nếu có thêm một lớp nữa phía trước (vd. Cloudflare → Nginx Proxy Manager → app).
 */
export function getClientIp(headers: Headers): string {
  const trustedProxies = Math.max(1, Number(process.env.TRUSTED_PROXY_COUNT) || 1);
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  return chain[chain.length - trustedProxies] ?? chain[0] ?? headers.get("x-real-ip") ?? "unknown";
}
