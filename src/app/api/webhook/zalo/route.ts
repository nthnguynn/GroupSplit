import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memberUserSelect, publicUserSelect } from "@/lib/user-select";
import { Prisma } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import { sendDirectZaloMessage, ZALO_WEBHOOK_SECRET_SETTING } from "@/lib/zalo";
import { rateLimit } from "@/lib/rate-limit";
import { zaloWebhookLogStore } from "@/lib/zalo-log-store";
import { calculateDebts } from "@/lib/debt-calculator";
import { formatVND } from "@/lib/utils/format";

function secretMatches(incoming: string | null, expected: string | null) {
  if (!incoming || !expected) return false;
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// 1. GET: Dùng cho Zalo Server verification (nếu Zalo gọi thử nghiệm GET)
export async function GET(req: NextRequest) {
  const challenge =
    req.nextUrl.searchParams.get("challenge") ||
    req.nextUrl.searchParams.get("hub.challenge");

  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  zaloWebhookLogStore.add({
    timestamp: new Date().toLocaleString("vi-VN"),
    method: "GET",
    headers: headersObj,
    body: Object.fromEntries(req.nextUrl.searchParams),
    status: 200,
    response: { challenge: challenge || null, message: "Zalo Webhook Active" },
  });

  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ message: "Zalo Webhook Endpoint Active" });
}

// 2. POST: Nhận Webhook từ Zalo Bot Platform
export async function POST(req: NextRequest) {
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  try {
    // Xác thực request thật sự đến từ Zalo: secret phải khớp ZALO_BOT_SECRET_TOKEN hoặc
    // secret Admin đã đăng ký qua /api/zalo/set-webhook. Không xác thực thì ai cũng giả được
    // tin nhắn với chatId tuỳ ý (dò mã /setup, gửi /nodu thay người khác).
    const incomingSecret = req.headers.get("x-bot-api-secret-token");
    if (headersObj["x-bot-api-secret-token"]) headersObj["x-bot-api-secret-token"] = "***";

    const envSecret = process.env.ZALO_BOT_SECRET_TOKEN?.trim() || null;
    const storedSecret =
      (
        await prisma.systemSetting.findUnique({
          where: { key: ZALO_WEBHOOK_SECRET_SETTING },
          select: { value: true },
        })
      )?.value ?? null;

    if (envSecret || storedSecret) {
      if (!secretMatches(incomingSecret, envSecret) && !secretMatches(incomingSecret, storedSecret)) {
        console.warn("[Zalo Webhook] Từ chối request: secret token không hợp lệ hoặc thiếu");
        zaloWebhookLogStore.add({
          timestamp: new Date().toLocaleString("vi-VN"),
          method: "POST",
          headers: headersObj,
          body: null,
          status: 401,
          response: { error: "Invalid secret token" },
        });
        return NextResponse.json({ error: "Invalid secret token" }, { status: 401 });
      }
    } else {
      console.warn("[Zalo Webhook] Chưa cấu hình ZALO_BOT_SECRET_TOKEN — không xác thực được nguồn request");
    }

    const body = await req.json().catch(() => ({}));
    console.log("[Zalo Webhook Received Body]:", JSON.stringify(body));

    const resultObj = body.result || body;
    const msg = resultObj.message || resultObj.edited_message || resultObj;

    const chatId =
      msg?.chat?.id ||
      msg?.from?.id ||
      msg?.sender?.id ||
      msg?.chat_id ||
      body?.chat_id ||
      body?.from?.id ||
      body?.sender?.id;

    const rawText = (
      msg?.text ||
      msg?.caption ||
      body?.text ||
      body?.message?.text ||
      ""
    ).trim();

    let processedAction = "No action token found";

    if (chatId && rawText) {
      const cleanCmd = rawText.toLowerCase().trim();

      // 1. Lệnh Help / Trợ giúp (\help, /help, \trogiup, /trogiup)
      if (
        cleanCmd === "/help" ||
        cleanCmd === "\\help" ||
        cleanCmd === "help" ||
        cleanCmd === "/trogiup" ||
        cleanCmd === "\\trogiup" ||
        cleanCmd === "trogiup" ||
        cleanCmd === "hướng dẫn" ||
        cleanCmd === "huong dan"
      ) {
        const helpText = `🤖 [GroupSplit Bot - Danh sách câu lệnh]

1️⃣ /help (hoặc \\help)
👉 Hiển thị danh sách các câu lệnh trợ giúp này.

2️⃣ /nodu (hoặc \\nodu, /duno, \\duno, /kttaikhoan, \\kttaikhoan)
👉 Kiểm tra tổng dư nợ cá nhân của bạn trong các nhóm.
👉 Nếu bạn đang NỢ TIỀN, Bot sẽ gửi ngay chi tiết kèm MÃ QR VIETQR (đã nạp sẵn số tiền & nội dung gạch nợ tự động) để bạn quét thanh toán ngay!

3️⃣ /setup <Mã_OTP_6_số> (hoặc \\setup <Mã_OTP>)
👉 Liên kết Zalo Chat ID với tài khoản GroupSplit của bạn trên website.
(Lấy mã OTP tại mục "Cài đặt cá nhân" trên website — mã có hiệu lực 10 phút).`;

        await sendDirectZaloMessage(String(chatId), helpText);
        processedAction = "Sent help message list";
      }
      // 2. Lệnh Kiểm tra dư nợ (\nodu, /nodu, \duno, /duno, \kttaikhoan...)
      else if (
        cleanCmd === "/nodu" ||
        cleanCmd === "\\nodu" ||
        cleanCmd === "/duno" ||
        cleanCmd === "\\duno" ||
        cleanCmd === "/balance" ||
        cleanCmd === "\\balance" ||
        cleanCmd === "nodu" ||
        cleanCmd === "duno" ||
        cleanCmd === "balance" ||
        cleanCmd === "/kttaikhoan" ||
        cleanCmd === "\\kttaikhoan" ||
        cleanCmd === "kttaikhoan"
      ) {
        const targetUser = await prisma.user.findFirst({
          where: { zaloChatId: String(chatId) },
        });

        if (!targetUser) {
          const unlinkedMsg = `⚠️ [GroupSplit] Zalo Chat ID của bạn chưa được liên kết với tài khoản GroupSplit!

Vui lòng vào trang "Cài đặt cá nhân" trên website GroupSplit để lấy mã OTP 6 số và gửi cú pháp:
/setup <Mã_OTP_6_số> (hoặc \\setup <Mã_OTP>)`;
          await sendDirectZaloMessage(String(chatId), unlinkedMsg);
          processedAction = "Debt check failed: Unlinked Zalo account";
        } else {
          const memberships = await prisma.groupMember.findMany({
            where: { userId: targetUser.id, isLeft: false },
            include: {
              group: {
                include: {
                  owner: { select: memberUserSelect },
                  members: { include: { user: { select: publicUserSelect } } },
                  expenses: {
                    where: { status: "APPROVED" },
                    include: { splits: true },
                  },
                  settlements: true,
                  fundAllocations: true,
                },
              },
            },
          });

          if (memberships.length === 0) {
            await sendDirectZaloMessage(
              String(chatId),
              `📊 Chào ${targetUser.displayName}! Bạn hiện chưa tham gia nhóm chia tiền nào.`
            );
            processedAction = "Debt check: User has no groups";
          } else {
            let totalNetBalance = 0;
            const debtGroupDetails: string[] = [];
            const qrMessagesToSend: string[] = [];

            for (const m of memberships) {
              const group = m.group;
              const { debts, balances } = calculateDebts(
                group.expenses as any,
                group.members as any,
                group.settlements as any,
                group.ownerId,
                group.fundAllocations as any
              );

              const myBal = balances.find((b) => b.userId === targetUser.id);
              const balAmount = myBal ? myBal.balance : 0;
              totalNetBalance += balAmount;

              // Người dùng đang NỢ tiền trong nhóm (balance < -0.01)
              if (balAmount < -0.01) {
                const debtAmount = Math.round(Math.abs(balAmount));
                const owner = group.owner;

                debtGroupDetails.push(
                  `• Nhóm "${group.name}": Nợ Trưởng nhóm ${owner.displayName} số tiền ${formatVND(debtAmount)}`
                );

                if (owner.bankName && owner.accountNumber) {
                  // Tạo bản ghi Settlement dạng [QR_PENDING] tự động
                  const settlement = await prisma.settlement.create({
                    data: {
                      groupId: group.id,
                      fromUserId: targetUser.id,
                      toUserId: owner.id,
                      amount: debtAmount,
                      note: `[QR_PENDING] Trả nợ qua Zalo Bot cho ${owner.displayName}`,
                      isConfirmed: false,
                    },
                  });

                  // URL ảnh VietQR kèm mã định danh GS<id> chuẩn SePay gạch nợ tự động
                  const qrImageUrl = `https://img.vietqr.io/image/${owner.bankName}-${owner.accountNumber}-compact2.png?amount=${debtAmount}&addInfo=GS${settlement.id}&accountName=${encodeURIComponent(owner.accountName || "")}`;

                  qrMessagesToSend.push(
                    `💳 [Mã QR Thanh Toán - Nhóm "${group.name}"]
👤 Người nhận: ${owner.displayName} (${owner.accountName || owner.displayName})
🏦 Ngân hàng: ${owner.bankName} - STK: ${owner.accountNumber}
💰 Số tiền: ${formatVND(debtAmount)}
📌 Cú pháp gạch nợ tự động: GS${settlement.id}

👉 Quét mã QR VietQR dưới đây để thanh toán tự động:
${qrImageUrl}`
                  );
                } else {
                  qrMessagesToSend.push(
                    `⚠️ [Nhóm "${group.name}"] Trưởng nhóm (${owner.displayName}) chưa cập nhật thông tin ngân hàng. Vui lòng liên hệ Trưởng nhóm để chuyển khoản thủ công.`
                  );
                }
              } else if (balAmount > 0.01) {
                debtGroupDetails.push(
                  `• Nhóm "${group.name}": Được Trưởng nhóm hoàn lại +${formatVND(Math.round(balAmount))}`
                );
              }
            }

            let summaryMsg = `📊 [Báo cáo Dư nợ - ${targetUser.displayName}]\n`;
            if (totalNetBalance < -0.01) {
              summaryMsg += `⚠️ Tổng dư nợ của bạn: -${formatVND(Math.abs(totalNetBalance))}\n\nChi tiết theo nhóm:\n${debtGroupDetails.join("\n")}`;
            } else if (totalNetBalance > 0.01) {
              summaryMsg += `🎉 Bạn hiện có số dư dương: +${formatVND(totalNetBalance)}\n\nChi tiết theo nhóm:\n${debtGroupDetails.join("\n")}`;
            } else {
              summaryMsg += `✅ Bạn hiện KHÔNG nợ tiền ai cả! Số dư: 0 ₫`;
            }

            await sendDirectZaloMessage(String(chatId), summaryMsg);

            for (const qrMsg of qrMessagesToSend) {
              await sendDirectZaloMessage(String(chatId), qrMsg);
            }

            processedAction = `Checked debt balance for user ${targetUser.username} (balance: ${totalNetBalance})`;
          }
        }
      }
      // 3. Lệnh Setup / Liên kết OTP (/setup <OTP>, \setup <OTP>, /start, \start...)
      else {
        let tokenArg = rawText
          .replace(/\/setupnoti/gi, "")
          .replace(/\\setupnoti/gi, "")
          .replace(/\/setup/gi, "")
          .replace(/\\setup/gi, "")
          .replace(/\/start/gi, "")
          .replace(/\\start/gi, "")
          .trim();

        if (!tokenArg && (rawText.startsWith("/") || rawText.startsWith("\\") || cleanCmd.includes("setup"))) {
          const helpText = `👋 [GroupSplit] Chào bạn!
          
Để cài đặt nhận thông báo Zalo cá nhân, vui lòng gửi theo cú pháp:
/setup <Mã_OTP_6_số> (hoặc \\setup <Mã_OTP>)

👉 Lấy mã OTP 6 số tại mục "Cài đặt cá nhân" trên website GroupSplit.`;

          await sendDirectZaloMessage(String(chatId), helpText);
          processedAction = "Sent setup help message";
        } else if (tokenArg) {
          // Chống dò mã: mỗi Zalo tối đa 5 lần thử /setup trong 10 phút, và cả hệ thống tối đa 30 lần/phút
          const chatLimiter = await rateLimit(`zalo-setup:${chatId}`, 5, 10 * 60 * 1000);
          const globalLimiter = chatLimiter.success
            ? await rateLimit("zalo-setup:global", 30, 60 * 1000)
            : chatLimiter;
          const limiter = { success: chatLimiter.success && globalLimiter.success };
          const code = tokenArg.replace(/\s+/g, "");

          // Chỉ liên kết bằng mã ngẫu nhiên còn hạn (KHÔNG nhận username — ai biết username cũng chiếm được).
          // Kiểm tra mã + liên kết + xoá mã trong 1 lệnh để mã chỉ dùng được 1 lần.
          let targetUser: { id: string; username: string; displayName: string } | null = null;
          if (limiter.success && /^\d{6}$/.test(code)) {
            try {
              targetUser = await prisma.user.update({
                where: { zaloLinkCode: code, zaloLinkCodeExpires: { gt: new Date() } },
                data: { zaloChatId: String(chatId), zaloLinkCode: null, zaloLinkCodeExpires: null },
                select: { id: true, username: true, displayName: true },
              });
            } catch (err) {
              if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) throw err;
            }
          }

          if (!limiter.success) {
            await sendDirectZaloMessage(
              String(chatId),
              `⚠️ [GroupSplit] Bạn đã thử liên kết quá nhiều lần. Vui lòng đợi 10 phút, lấy mã mới tại mục "Cài đặt cá nhân" rồi thử lại.`
            );
            processedAction = "Setup rate limited";
          } else if (targetUser) {
            const confirmText = `🟢 [GroupSplit] Liên kết Zalo thành công!

Tài khoản: @${targetUser.username} (${targetUser.displayName})
Zalo Chat ID: ${chatId}

Từ giờ các thông báo hóa đơn, nợ và duyệt tiền cá nhân của bạn sẽ tự động gửi trực tiếp tới đây! 🎉
💡 Bạn có thể gửi lệnh /nodu hoặc \\nodu bất kỳ lúc nào để kiểm tra nợ & lấy mã QR thanh toán!`;

            await sendDirectZaloMessage(String(chatId), confirmText);
            processedAction = `Linked user ${targetUser.username} with chatId ${chatId}`;
          } else {
            const helpText = `⚠️ [GroupSplit] Mã "${tokenArg}" không đúng hoặc đã hết hạn.

Mã liên kết chỉ có hiệu lực 10 phút và dùng được 1 lần. Vui lòng vào trang Cài đặt cá nhân trên website GroupSplit để lấy mã mới và gửi lại cú pháp:
/setup <Mã_OTP_6_số>`;

            await sendDirectZaloMessage(String(chatId), helpText);
            processedAction = `Link code invalid or expired: ${tokenArg}`;
          }
        }
      }
    }

    const responseObj = { message: "Success", processedAction, chatId, rawText };

    zaloWebhookLogStore.add({
      timestamp: new Date().toLocaleString("vi-VN"),
      method: "POST",
      headers: headersObj,
      body,
      status: 200,
      response: responseObj,
    });

    return NextResponse.json(responseObj);
  } catch (err: any) {
    console.error("[Zalo Webhook Error]:", err);
    zaloWebhookLogStore.add({
      timestamp: new Date().toLocaleString("vi-VN"),
      method: "POST",
      headers: headersObj,
      body: {},
      status: 500,
      response: { error: err.message },
    });
    return NextResponse.json(
      { message: "Webhook Error", error: err.message },
      { status: 500 }
    );
  }
}
