"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MailCheck, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !otp) {
      toast.error("Vui lòng nhập Email và mã OTP 6 số");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setVerified(true);
        toast.success(data.message || "Xác thực Email thành công!");
      } else {
        toast.error(data.error || "Xác thực thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error("Vui lòng nhập Email của bạn để nhận lại mã");
      return;
    }

    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setResending(false);

      if (res.ok) {
        toast.success(data.message || "Đã gửi lại mã OTP!");
      } else {
        toast.error(data.error || "Không thể gửi lại mã OTP");
      }
    } catch (err) {
      setResending(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <Card className="rounded-2xl border bg-card shadow-sm p-2 sm:p-4">
      <CardHeader className="text-center space-y-1">
        <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 mb-2">
          {verified ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <MailCheck className="h-6 w-6" />}
        </div>
        <CardTitle className="text-xl font-bold">
          {verified ? "Xác thực Email thành công!" : "Xác thực tài khoản Email"}
        </CardTitle>
        <CardDescription className="text-xs">
          {verified
            ? "Tài khoản của bạn đã kích hoạt hoàn tất. Hãy đăng nhập để trải nghiệm GroupSplit ngay!"
            : "Nhập mã OTP 6 số đã được gửi tới địa chỉ Email của bạn."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {verified ? (
          <div className="space-y-4 pt-2">
            <Button asChild className="w-full h-11 font-bold bg-emerald-600 hover:bg-emerald-700">
              <Link href="/login">Chuyển sang trang Đăng nhập ngay</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Địa chỉ Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 font-medium"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="otp">Mã xác thực OTP (6 số)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={resending}
                  className="h-7 text-xs text-blue-600 gap-1 cursor-pointer"
                >
                  {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Gửi lại mã OTP
                </Button>
              </div>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="h-12 font-mono text-center font-bold text-lg tracking-[0.5em]"
              />
            </div>

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                "Kích hoạt tài khoản"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-muted/20">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại Đăng nhập
          </Link>
          <BrandLogo size="md" />
        </div>

        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
