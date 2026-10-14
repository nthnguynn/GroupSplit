import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { eventEmitter } from "@/lib/events";
import { sendMultipleUsersZaloNotification } from "@/lib/zalo";
import { formatVND } from "@/lib/utils/format";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  console.log(`[SePay Webhook] Nhận yêu cầu POST cho userId: ${userId}`);

  try {
    // 2. Lấy raw body text và các headers bảo mật
    const body = await req.text();
    console.log(`[SePay Webhook] Raw Body: ${body}`);

    // 1. Lấy thông tin user nhận tiền (Owner) để lấy webhook secret
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { sepayWebhookSecret: true },
    });

    if (!owner || !owner.sepayWebhookSecret) {
      console.warn(`[SePay Webhook] User ${userId} chưa thiết lập Webhook Secret.`);
      return NextResponse.json({ success: false, message: "User not configured" }, { status: 400 });
    }

    const signature = req.headers.get("x-sepay-signature") || "";
    const timestampHeader = req.headers.get("x-sepay-timestamp") || "0";
    const timestamp = Number(timestampHeader);

    // Chống replay: timestamp lệch quá 5 phút
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
      console.warn(`[SePay Webhook] Request đã hết hạn (timestamp lệch quá 5 phút).`);
      return NextResponse.json({ success: false, message: "Request expired" }, { status: 401 });
    }

    // 3. Xác thực chữ ký HMAC-SHA256
    const expected = "sha256=" + crypto
      .createHmac("sha256", owner.sepayWebhookSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      console.warn(`[SePay Webhook] Chữ ký không hợp lệ.`);
      return NextResponse.json({ success: false, message: "Invalid signature" }, { status: 401 });
    }

    // 4. Parse JSON payload
    const data = JSON.parse(body);
    if (!data || data.id === undefined || data.id === null) {
      return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
    }

    // 5. Chống trùng giao dịch bằng database
    try {
      await prisma.sepayTransaction.create({
        data: {
          id: String(data.id),
          gateway: data.gateway,
          transactionDate: new Date(data.transactionDate),
          accountNumber: data.accountNumber,
          transferType: data.transferType,
          transferAmount: parseFloat(data.transferAmount),
          content: data.content,
          userId: userId,
        },
      });
    } catch (dbError: any) {
      // Unique constraint failed (trùng ID giao dịch SePay)
      // Trả về success: true luôn để SePay không gửi lại (idempotent)
      if (dbError.code === "P2002") {
        console.log(`[SePay Webhook] Giao dịch ${data.id} đã xử lý trước đó. Bỏ qua.`);
        return NextResponse.json({ success: true });
      }
      throw dbError;
    }

    // 6. Xử lý gạch nợ (chỉ tiền vào "in")
    if (data.transferType === "in" && data.content) {
      // Tìm mã định danh GS[settlementId] trong nội dung chuyển khoản
      const match = data.content.match(/GS([a-zA-Z0-9]+)/);
      if (match) {
        const settlementId = match[1];

        // Tìm Settlement trong DB
        const settlement = await prisma.settlement.findUnique({
          where: { id: settlementId },
        });

        if (settlement && !settlement.isConfirmed) {
          // Cập nhật Settlement thành đã xác nhận
          const updatedSettlement = await prisma.settlement.update({
            where: { id: settlementId },
            data: {
              isConfirmed: true,
              // Xóa tiền tố [QR_PENDING] nếu còn
              note: settlement.note?.startsWith("[QR_PENDING]")
                ? settlement.note.replace(/^\[QR_PENDING\]\s*/, "")
                : settlement.note,
            },
            include: {
              fromUser: { select: { displayName: true } },
              toUser: { select: { displayName: true } },
            },
          });

          // Phát sóng tin nhắn cập nhật cho tất cả client
          eventEmitter.emit(`group:${settlement.groupId}`, { type: "REFRESH" });

          // Gửi thông báo Zalo Bot cá nhân
          const msg = `⚡ [Duyệt tiền tự động VietQR]
Hệ thống đã tự động gạch nợ thành công!
${updatedSettlement.fromUser.displayName} ➔ ${updatedSettlement.toUser.displayName}
💰 Số tiền: ${formatVND(updatedSettlement.amount)}
📌 Xác thực tự động qua SePay 🟢`;

          sendMultipleUsersZaloNotification(
            [updatedSettlement.fromUserId, updatedSettlement.toUserId],
            msg
          );

          console.log(`[SePay Webhook] Đã xác nhận tự động Settlement ID ${settlementId} số tiền ${data.transferAmount}đ.`);
        } else {
          console.log(`[SePay Webhook] Không khớp Settlement hoặc đã được xác nhận trước: ID ${settlementId}`);
        }
      }

      // 6.2 Xử lý Góp quỹ (mã định danh GQ[contributionId])
      const matchContribution = data.content.match(/GQ([a-zA-Z0-9]+)/);
      if (matchContribution) {
        const contributionId = matchContribution[1];
        const contribution = await prisma.fundContribution.findUnique({
          where: { id: contributionId },
          include: {
            group: { select: { id: true, name: true, ownerId: true } },
            user: { select: { id: true, displayName: true } },
          },
        });

        if (contribution && contribution.status !== "CONFIRMED") {
          await prisma.fundContribution.update({
            where: { id: contributionId },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
            },
          });

          // Phát sóng SSE
          eventEmitter.emit(`group:${contribution.groupId}`, { type: "REFRESH" });

          // Thông báo In-app cho người góp quỹ
          await createNotification({
            userId: contribution.userId,
            title: "Khoản góp quỹ đã được xác nhận tự động",
            content: `Hệ thống đã tự động xác nhận khoản góp quỹ ${formatVND(contribution.amount)} vào nhóm "${contribution.group.name}" qua SePay.`,
            type: "EXPENSE_APPROVED",
            link: `/groups/${contribution.groupId}`,
            entityId: contribution.id,
          });

          // Gửi thông báo Zalo Bot
          const msg = `⚡ [Tự động xác nhận Góp quỹ VietQR]
👥 Nhóm: ${contribution.group.name}
👤 Người góp: ${contribution.user.displayName}
💰 Số tiền: ${formatVND(contribution.amount)}
📌 Trạng thái: 🟢 Đã ghi nhận vào Quỹ nhóm qua SePay!`;

          sendMultipleUsersZaloNotification(
            [contribution.userId, contribution.group.ownerId],
            msg
          );

          console.log(`[SePay Webhook] Đã xác nhận tự động FundContribution ID ${contributionId} số tiền ${data.transferAmount}đ.`);
        } else {
          console.log(`[SePay Webhook] Không khớp FundContribution hoặc đã được xác nhận trước: ID ${contributionId}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SePay Webhook] Lỗi hệ thống:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
