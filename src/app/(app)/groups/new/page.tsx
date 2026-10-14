import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Tạo nhóm mới - GroupSplit",
};

export default async function NewGroupPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id! },
    select: {
      bankName: true,
      accountNumber: true,
      accountName: true,
      sepayWebhookSecret: true,
    },
  });

  const isConfigured =
    user?.bankName &&
    user?.accountNumber &&
    user?.accountName &&
    user?.sepayWebhookSecret;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tạo nhóm mới</h1>
        <p className="text-muted-foreground text-sm">
          Điền thông tin để tạo nhóm và bắt đầu chia sẻ chi tiêu
        </p>
      </div>

      {!isConfigured ? (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 p-6">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-4">
            <div>
              <AlertTitle className="text-base font-bold text-destructive">
                Yêu cầu thiết lập tài khoản
              </AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
                Để làm Trưởng nhóm, bạn bắt buộc phải thiết lập **Thông tin ngân hàng** và **Tích hợp SePay Webhook** trước.
                Việc này giúp thành viên trong nhóm quét mã QR thanh toán nợ cho bạn được thuận tiện và hệ thống tự động gạch nợ ngay lập tức khi bạn nhận được tiền.
              </AlertDescription>
            </div>
            <Button asChild variant="destructive" className="font-bold">
              <Link href="/settings">Đi tới cài đặt ngay</Link>
            </Button>
          </div>
        </Alert>
      ) : (
        <CreateGroupForm />
      )}
    </div>
  );
}
