"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw, ShieldCheck, Loader2 } from "lucide-react";

interface CaptchaChallengeProps {
  onCaptchaChange: (captchaData: {
    id: string;
    answer: string;
    hash: string;
  }) => void;
}

export function CaptchaChallenge({ onCaptchaChange }: CaptchaChallengeProps) {
  const [captcha, setCaptcha] = useState<{
    id: string;
    question: string;
    hash: string;
  } | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/captcha?t=" + Date.now());
      const data = await res.json();
      setCaptcha(data);
      setUserAnswer("");
      onCaptchaChange({ id: data.id, answer: "", hash: data.hash });
    } catch (err) {
      console.error("Failed to load captcha", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleInputChange = (val: string) => {
    setUserAnswer(val);
    if (captcha) {
      onCaptchaChange({ id: captcha.id, answer: val, hash: captcha.hash });
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-xl border bg-muted/30 border-blue-500/20">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
          <ShieldCheck className="h-4 w-4" />
          Xác thực CAPTCHA chống Bot / DDoS
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={fetchCaptcha}
          disabled={loading}
          className="h-7 px-2 text-xs gap-1 cursor-pointer hover:bg-blue-500/10"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Đổi phép tính
        </Button>
      </div>

      <div className="space-y-2">
        <div className="bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-200 text-xs sm:text-sm font-medium p-3 rounded-lg border border-slate-800 shadow-inner select-none leading-relaxed flex items-start gap-2">
          <span className="font-bold text-amber-400 shrink-0 select-none">🧮 Phép tính:</span>
          <span>{captcha ? captcha.question : "Đang tải phép tính..."}</span>
        </div>
        <Input
          type="text"
          placeholder="Nhập kết quả phép tính..."
          value={userAnswer}
          onChange={(e) => handleInputChange(e.target.value)}
          className="h-10 text-sm font-medium"
          required
          autoComplete="off"
        />
      </div>
    </div>
  );
}
