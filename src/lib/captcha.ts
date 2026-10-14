import crypto from "node:crypto";

const SECRET = process.env.AUTH_SECRET || "groupsplit_captcha_secret_key_2026";

export interface CaptchaData {
  id: string;
  question: string;
  hash: string;
}

export type MathOperator = "+" | "-" | "×" | "÷";

export interface MathProblem {
  question: string;
  answer: number;
}

/**
 * Sinh ngẫu nhiên câu hỏi phép tính số học: +, -, ×, ÷
 * Đảm bảo:
 * - Phép trừ luôn có kết quả dương (a >= b)
 * - Phép nhân là các số nhỏ dễ nhẩm (2 - 9)
 * - Phép chia luôn chia hết thành số nguyên đẹp
 */
export function generateMathProblem(): MathProblem {
  const operations: MathOperator[] = ["+", "-", "×", "÷"];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let a = 0;
  let b = 0;
  let answer = 0;

  switch (op) {
    case "+": {
      // a từ 2 đến 50, b từ 2 đến 50
      a = Math.floor(Math.random() * 49) + 2;
      b = Math.floor(Math.random() * 49) + 2;
      answer = a + b;
      break;
    }
    case "-": {
      // a từ 10 đến 99, b từ 2 đến a - 1 => kết quả luôn >= 1
      a = Math.floor(Math.random() * 90) + 10;
      b = Math.floor(Math.random() * (a - 2)) + 2;
      answer = a - b;
      break;
    }
    case "×": {
      // a từ 2 đến 9, b từ 2 đến 9 (bảng cửu chương)
      a = Math.floor(Math.random() * 8) + 2;
      b = Math.floor(Math.random() * 8) + 2;
      answer = a * b;
      break;
    }
    case "÷": {
      // Số chia b từ 2 đến 9, thương answer từ 2 đến 10 => a = b * answer (luôn chia hết)
      b = Math.floor(Math.random() * 8) + 2;
      answer = Math.floor(Math.random() * 9) + 2;
      a = b * answer;
      break;
    }
  }

  return {
    question: `${a} ${op} ${b} = ?`,
    answer,
  };
}

/**
 * Hỗ trợ chuyển đổi từ chữ số tiếng Việt cơ bản (từ 0 đến 100) sang số
 * phòng trường hợp người dùng gõ chữ thay vì số.
 */
function parseVietnameseWordsToNumber(input: string): number | null {
  const clean = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");

  if (!clean) return null;

  const basicMap: Record<string, number> = {
    "khong": 0, "mot": 1, "hai": 2, "ba": 3, "bon": 4, "tu": 4, "nam": 5, "lam": 5,
    "sau": 6, "bay": 7, "tam": 8, "chin": 9, "muoi": 10, "chuc": 10, "tram": 100, "mot tram": 100,
  };

  if (basicMap[clean] !== undefined) {
    return basicMap[clean];
  }

  const parts = clean.split(" ");
  // 11 -> 19: "muoi mot" ... "muoi chin"
  if (parts.length === 2 && parts[0] === "muoi") {
    const unit = basicMap[parts[1]];
    if (unit !== undefined && unit >= 1 && unit <= 9) {
      return 10 + unit;
    }
  }

  // 20, 30... 90: "hai muoi"
  if (parts.length === 2 && parts[1] === "muoi") {
    const tens = basicMap[parts[0]];
    if (tens !== undefined && tens >= 2 && tens <= 9) {
      return tens * 10;
    }
  }

  // 21 -> 99: "hai muoi ba", "ba muoi lam"...
  if (parts.length === 3 && parts[1] === "muoi") {
    const tens = basicMap[parts[0]];
    const unit = basicMap[parts[2]];
    if (tens !== undefined && tens >= 2 && tens <= 9 && unit !== undefined && unit >= 1 && unit <= 9) {
      return tens * 10 + unit;
    }
  }

  return null;
}

/**
 * Chuẩn hóa chuỗi câu trả lời từ người dùng thành chuỗi số nguyên:
 * - Cắt khoảng trắng
 * - Xử lý số nguyên: "15", " 15 ", "015" -> "15"
 * - Hỗ trợ chữ số tiếng Việt cơ bản
 */
export function normalizeAnswer(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const parsed = parseInt(trimmed, 10);
  if (!isNaN(parsed)) {
    return String(parsed);
  }

  const wordNum = parseVietnameseWordsToNumber(trimmed);
  if (wordNum !== null) {
    return String(wordNum);
  }

  return "";
}

/**
 * Sinh ngẫu nhiên câu hỏi phép tính và tạo mã băm hash HMAC để xác thực
 */
export function generateCaptcha(): CaptchaData {
  const problem = generateMathProblem();
  const id = crypto.randomBytes(8).toString("hex");
  const timestamp = Date.now();
  const rawPayload = `${id}:${problem.answer}:${timestamp}`;

  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(rawPayload)
    .digest("hex");

  // Format: signature.timestamp
  const hash = `${signature}.${timestamp}`;

  return {
    id,
    question: problem.question,
    hash,
  };
}

/**
 * Kiểm tra kết quả phép tính CAPTCHA từ phía client gửi lên
 */
export function verifyCaptcha(
  id: string,
  userAnswer: string,
  hash: string
): boolean {
  if (!id || !userAnswer || !hash) return false;

  const parts = hash.split(".");
  if (parts.length < 2) return false;

  const [expectedSignature, timestampStr] = parts;
  const timestamp = Number(timestampStr);

  // Hết hạn CAPTCHA sau 5 phút
  if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
    return false;
  }

  const normalizedUser = normalizeAnswer(userAnswer);
  if (!normalizedUser) return false;

  // Xác thực chữ ký HMAC để bảo đảm câu hỏi & timestamp không bị can thiệp
  const rawPayload = `${id}:${normalizedUser}:${timestamp}`;
  const computedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(rawPayload)
    .digest("hex");

  if (
    Buffer.byteLength(computedSignature) !==
    Buffer.byteLength(expectedSignature)
  ) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
