"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { CaptchaChallenge } from "@/components/auth/captcha-challenge";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaData, setCaptchaData] = useState<{
    id: string;
    answer: string;
    hash: string;
  }>({ id: "", answer: "", hash: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrUsername) {
      toast.error("Vui lòng nhập Username hoặc Email");
      return;
    }
    if (!captchaData.answer) {
      toast.error("Vui lòng hoàn thành phép tính CAPTCHA");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername,
          captchaId: captchaData.id,
          captchaAnswer: captchaData.answer,
          captchaHash: captchaData.hash,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success(data.message || "Đã gửi mã khôi phục mật khẩu!");
        router.push(
          `/reset-password?target=${encodeURIComponent(emailOrUsername)}`
        );
      } else {
        toast.error(data.error || "Không thể yêu cầu khôi phục");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

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

        <Card className="rounded-2xl border bg-card shadow-sm p-2 sm:p-4">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold">Quên mật khẩu?</CardTitle>
            <CardDescription className="text-xs">
              Nhập Tên đăng nhập hoặc địa chỉ Email của bạn để nhận mã OTP khôi phục mật khẩu.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailOrUsername">Username hoặc Email</Label>
                <Input
                  id="emailOrUsername"
                  placeholder="qy286 hoặc example@domain.com"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* CAPTCHA Anti-DDoS */}
              <CaptchaChallenge onCaptchaChange={setCaptchaData} />

              <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi mã OTP...
                  </>
                ) : (
                  "Gửi mã OTP khôi phục"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
