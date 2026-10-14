"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CaptchaChallenge } from "@/components/auth/captcha-challenge";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [emailOrUsername, setEmailOrUsername] = useState(
    searchParams.get("target") || ""
  );
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [captchaData, setCaptchaData] = useState<{
    id: string;
    answer: string;
    hash: string;
  }>({ id: "", answer: "", hash: "" });

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrUsername || !otp || !newPassword) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (!captchaData.answer) {
      toast.error("Vui lòng hoàn thành phép tính CAPTCHA");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername,
          otp,
          newPassword,
          captchaId: captchaData.id,
          captchaAnswer: captchaData.answer,
          captchaHash: captchaData.hash,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setCompleted(true);
        toast.success(data.message || "Đặt lại mật khẩu thành công!");
      } else {
        toast.error(data.error || "Đặt lại mật khẩu thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <Card className="rounded-2xl border bg-card shadow-sm p-2 sm:p-4">
      <CardHeader className="text-center space-y-1">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2">
          {completed ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <KeyRound className="h-6 w-6" />
          )}
        </div>
        <CardTitle className="text-xl font-bold">
          {completed ? "Đổi mật khẩu thành công!" : "Đặt lại Mật khẩu Mới"}
        </CardTitle>
        <CardDescription className="text-xs">
          {completed
            ? "Mật khẩu mới của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại."
            : "Nhập mã OTP 6 số đã được gửi tới Email và tạo mật khẩu mới cho tài khoản."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {completed ? (
          <div className="space-y-4 pt-2">
            <Button asChild className="w-full h-11 font-bold bg-emerald-600 hover:bg-emerald-700">
              <Link href="/login">Đăng nhập bằng Mật khẩu Mới ngay</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">Username hoặc Email</Label>
              <Input
                id="emailOrUsername"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
                className="h-11 font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">Mã OTP Khôi phục (6 số)</Label>
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

            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Tối thiểu 8 ký tự, gồm chữ & số"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* CAPTCHA Challenge */}
            <CaptchaChallenge onCaptchaChange={setCaptchaData} />

            <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Xác nhận đặt lại Mật khẩu"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
