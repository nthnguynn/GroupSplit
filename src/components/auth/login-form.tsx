"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import { CaptchaChallenge } from "./captcha-challenge";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaData, setCaptchaData] = useState<{
    id: string;
    answer: string;
    hash: string;
  }>({ id: "", answer: "", hash: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!captchaData.answer) {
      toast.error("Vui lòng hoàn thành phép tính CAPTCHA trước khi đăng nhập");
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = (formData.get("username") as string).trim();
    const password = formData.get("password") as string;

    try {
      // 1. Kiểm tra chính xác trạng thái tài khoản & xác thực email từ API login-check
      const checkRes = await fetch("/api/auth/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          captchaId: captchaData.id,
          captchaAnswer: captchaData.answer,
          captchaHash: captchaData.hash,
        }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setLoading(false);

        if (checkData.code === "UNVERIFIED_EMAIL") {
          toast.error("Tài khoản chưa kích thực Email! Vui lòng nhập mã OTP để kích hoạt.");
          const redirectEmail = checkData.email || "";
          router.push(`/verify-email?email=${encodeURIComponent(redirectEmail)}`);
          return;
        }

        toast.error(checkData.error || "Tên đăng nhập hoặc mật khẩu không chính xác");
        return;
      }

      // 2. Nếu thông tin và trạng thái kích hoạt đều hợp lệ, tiến hành tạo phiên đăng nhập NextAuth
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      setLoading(false);

      if (result?.error) {
        toast.error("Không thể hoàn tất phiên đăng nhập");
      } else {
        toast.success("Đăng nhập thành công!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setLoading(false);
      toast.error("Đã xảy ra lỗi kết nối khi đăng nhập");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-card shadow-sm p-6 space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Tên đăng nhập</Label>
        <Input
          id="username"
          name="username"
          placeholder="username"
          required
          autoComplete="username"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mật khẩu</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <KeyRound className="h-3 w-3" />
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="h-11 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* CAPTCHA Challenge chống DDoS */}
      <CaptchaChallenge onCaptchaChange={setCaptchaData} />

      <Button type="submit" className="w-full h-11 font-bold" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          "Đăng nhập"
        )}
      </Button>

      <div className="text-center pt-2 border-t">
        <Link
          href="/verify-email"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <MailCheck className="h-3.5 w-3.5 text-emerald-500" />
          Đã đăng ký nhưng chưa nhập OTP kích hoạt Email?
        </Link>
      </div>
    </form>
  );
}
