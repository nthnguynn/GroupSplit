"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, Copy, Check, SendHorizontal, ExternalLink, Unlink, Loader2, ShieldCheck, Sparkles, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProfileZaloSettingsProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    zaloChatId: string | null;
  };
}

export function ProfileZaloSettings({ user }: ProfileZaloSettingsProps) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Mã liên kết do server sinh ngẫu nhiên, dùng 1 lần, hết hạn sau 10 phút
  const [linkCode, setLinkCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loadingCode, setLoadingCode] = useState(!user.zaloChatId);

  const fetchLinkCode = useCallback(async () => {
    try {
      const res = await fetch("/api/user/zalo-link-code", { method: "POST" });
      const data = await res.json();
      if (res.ok) setLinkCode(data);
      else toast.error(data.error || "Không lấy được mã liên kết");
    } catch {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoadingCode(false);
    }
  }, []);

  useEffect(() => {
    if (!user.zaloChatId) fetchLinkCode();
  }, [user.zaloChatId, fetchLinkCode]);

  const regenerateCode = () => {
    setLoadingCode(true);
    fetchLinkCode();
  };

  const otpCode = linkCode?.code ?? "";
  const commandText = `/setup ${otpCode || "------"}`;
  const expiresAtText = linkCode
    ? new Date(linkCode.expiresAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";

  const copyOtp = async () => {
    if (!otpCode) return;
    await navigator.clipboard.writeText(otpCode);
    setCopiedOtp(true);
    toast.success(`Đã copy mã OTP: ${otpCode}`);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const copyCommand = async () => {
    if (!otpCode) return;
    await navigator.clipboard.writeText(commandText);
    setCopiedCmd(true);
    toast.success(`Đã copy cú pháp: ${commandText}`);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  async function handleTestNotification() {
    if (!user.zaloChatId) return;
    setTesting(true);
    try {
      const res = await fetch("/api/user/test-zalo", { method: "POST" });
      const data = await res.json();
      setTesting(false);

      if (res.ok) {
        toast.success("Đã gửi tin nhắn Zalo thử nghiệm thành công! Hãy kiểm tra Zalo.");
      } else {
        toast.error(data.error || "Gửi tin nhắn thử nghiệm thất bại");
      }
    } catch (err) {
      setTesting(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  async function handleUnlinkZalo() {
    if (!confirm("Bạn có chắc chắn muốn hủy liên kết Zalo cá nhân không?")) return;
    setUnlinking(true);
    try {
      const res = await fetch("/api/user/unlink-zalo", { method: "POST" });
      setUnlinking(false);

      if (res.ok) {
        toast.success("Đã hủy liên kết Zalo thành công!");
        router.refresh();
      } else {
        toast.error("Không thể hủy liên kết Zalo");
      }
    } catch (err) {
      setUnlinking(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Bot className="h-5 w-5 text-blue-500" />
            Cài đặt Thông báo Zalo Cá nhân
          </CardTitle>
          {user.zaloChatId ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" /> Đã liên kết Zalo
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
              🟡 Chưa liên kết
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs leading-relaxed">
          Nhận thông báo tự động trực tiếp trên Zalo cá nhân mỗi khi có hóa đơn, trả nợ hoặc phê duyệt liên quan đến bạn.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {user.zaloChatId ? (
          /* TRẠNG THÁI ĐÃ LIÊN KẾT */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-card border space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold">Tài khoản Zalo Chat ID:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{user.zaloChatId}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mọi thông báo cá nhân sẽ được gửi trực tiếp đến Zalo của bạn qua Bot.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleTestNotification}
                disabled={testing}
                className="flex-1 gap-1.5 h-10 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                Gửi thử tin nhắn Zalo
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleUnlinkZalo}
                disabled={unlinking}
                className="gap-1.5 h-10 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 dark:border-rose-900 cursor-pointer"
              >
                {unlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Hủy liên kết
              </Button>
            </div>
          </div>
        ) : (
          /* TRẠNG THÁI CHƯA LIÊN KẾT */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-card border space-y-3">
              <p className="text-xs font-semibold text-foreground">
                📌 2 Bước kết nối Zalo cá nhân cực kỳ dễ dàng:
              </p>

              <div className="bg-muted/70 p-3 rounded-lg flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-semibold">Mã OTP xác thực cá nhân:</span>
                  <span className="text-2xl font-mono font-black tracking-widest text-blue-600 dark:text-blue-400">
                    {loadingCode ? <Loader2 className="h-6 w-6 animate-spin my-1" /> : otpCode || "------"}
                  </span>
                  {linkCode && !loadingCode && (
                    <span className="text-[11px] text-muted-foreground block">
                      Dùng 1 lần, hết hạn lúc {expiresAtText}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyOtp}
                    disabled={!otpCode || loadingCode}
                    className="gap-1 text-xs font-semibold cursor-pointer"
                  >
                    {copiedOtp ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy OTP
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={regenerateCode}
                    disabled={loadingCode}
                    className="gap-1 text-xs cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Lấy mã mới
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>
                  1. Bấm nút bên dưới để mở trò chuyện với <b>Zalo Bot</b>.
                </p>
                <p>
                  2. Gửi cú pháp bên dưới cho Bot:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-900 text-emerald-400 font-mono px-3 py-1.5 rounded-md text-xs font-bold flex-1 select-all">
                    {commandText}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={copyCommand}
                    disabled={!otpCode || loadingCode}
                    className="h-8 px-2 text-xs cursor-pointer"
                  >
                    {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://bot.zaloplatforms.com/bots/2019095361100437498"
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Mở Zalo nhắn tin cho Bot ngay
                <ExternalLink className="h-4 w-4" />
              </a>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.refresh()}
                className="h-11 px-4 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-blue-500" />
                Kiểm tra sau khi đã gửi
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
