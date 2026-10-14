"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RefreshCw, Copy, Check, Bot, MessageSquare, AlertCircle, ArrowLeft, Trash2, Code, ShieldCheck, Activity } from "lucide-react";
import Link from "next/link";

interface WebhookLog {
  id: string;
  timestamp: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  status: number;
  response: any;
}

export default function ZaloHelperPage() {
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settingWebhook, setSettingWebhook] = useState(false);

  // Lấy thông tin getWebhookInfo hiện tại
  async function fetchWebhookInfo() {
    try {
      const res = await fetch("/api/zalo/set-webhook");
      const data = await res.json();
      if (data.success && data.data) {
        setWebhookInfo(data.data);
      }
    } catch (err) {
      console.error("Fetch webhook info error:", err);
    }
  }

  // Lấy danh sách Webhook Logs thực tế đã nhận được trên Server
  async function fetchWebhookLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/zalo/webhook-logs");
      const data = await res.json();
      setLoading(false);
      if (data.success && Array.isArray(data.logs)) {
        setWebhookLogs(data.logs);
      }
    } catch (err) {
      setLoading(false);
    }
  }

  // Đăng ký lại Webhook URL với Zalo Server
  async function handleSetWebhook() {
    setSettingWebhook(true);
    try {
      const res = await fetch("/api/zalo/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: `${window.location.origin}/api/webhook/zalo`,
        }),
      });
      const data = await res.json();
      setSettingWebhook(false);

      if (res.ok) {
        toast.success(data.message || "Đăng ký Webhook thành công!");
        fetchWebhookInfo();
      } else {
        toast.error(data.error || "Đăng ký Webhook thất bại");
      }
    } catch (err) {
      setSettingWebhook(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // Tự động làm mới mỗi 2 giây
  useEffect(() => {
    fetchWebhookInfo();
    fetchWebhookLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchWebhookLogs();
      fetchWebhookInfo();
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const clearLogs = async () => {
    await fetch("/api/zalo/webhook-logs", { method: "DELETE" });
    setWebhookLogs([]);
    toast.success("Đã xóa sạch nhật ký Webhook");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Bảng điều khiển
        </Link>
        <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 font-mono text-xs">
          <Bot className="h-3.5 w-3.5" /> Zalo Bot Realtime Webhook Inspector
        </Badge>
      </div>

      {/* Main Card: Webhook Status */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center justify-between gap-2 text-foreground">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Trạng thái Webhook Zalo Bot (`getWebhookInfo`)
            </span>
            <Button
              onClick={handleSetWebhook}
              disabled={settingWebhook}
              size="sm"
              className="gap-1.5 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {settingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Kích hoạt / Đăng ký lại Webhook
            </Button>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Kiểm tra xem Zalo Server đã lưu Webhook URL của ứng dụng chưa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookInfo ? (
            <div className="bg-card border rounded-xl p-3.5 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">Trạng thái Zalo Webhook:</span>
                <Badge className={webhookInfo.result?.url ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}>
                  {webhookInfo.result?.url ? "🟢 ĐÃ KÍCH HOẠT" : "🔴 CHƯA KÍCH HOẠT"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">Webhook URL hiện tại:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 select-all">
                  {webhookInfo.result?.url || "Chưa có URL"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Đang kiểm tra trạng thái Zalo Server...
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={(val) => {
                  setAutoRefresh(val);
                  if (val) toast.info("Đã bật tự động theo dõi log mỗi 2 giây");
                }}
              />
              <Label htmlFor="auto-refresh" className="text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                Tự động theo dõi Nhật ký Webhook thời gian thực (Realtime - 2s)
              </Label>
            </div>

            <Button
              onClick={fetchWebhookLogs}
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-1.5 font-bold text-xs h-9 cursor-pointer"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Làm mới ngay ({webhookLogs.length} logs)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Realtime Webhook Logs Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Nhật ký Tin nhắn Webhook thực tế nhận được ({webhookLogs.length})
          </h3>
          {webhookLogs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="text-xs text-muted-foreground hover:text-rose-500 h-8 px-2 gap-1 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa nhật ký
            </Button>
          )}
        </div>

        {webhookLogs.length === 0 ? (
          <Card className="border-dashed text-center p-8 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              Chưa nhận được tín hiệu Webhook nào từ Zalo Server.
            </p>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Vui lòng mở ứng dụng Zalo, tìm Zalo Bot và gửi tin nhắn <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">/setup &lt;OTP&gt;</code>. Khi Zalo Server gọi về ứng dụng, tín hiệu JSON sẽ ngay lập tức xuất hiện tại đây!
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {webhookLogs.map((log) => (
              <Card key={log.id} className="border hover:border-blue-500/30 transition-colors shadow-sm overflow-hidden">
                <CardHeader className="py-2.5 px-4 bg-muted/40 flex flex-row items-center justify-between border-b">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                    <Badge variant={log.status === 200 ? "default" : "destructive"} className="text-[10px]">
                      {log.method} {log.status}
                    </Badge>
                    <span className="text-muted-foreground text-[11px] font-sans">{log.timestamp}</span>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    ID: {log.id}
                  </Badge>
                </CardHeader>

                <CardContent className="p-4 space-y-3 font-mono text-xs">
                  {/* Action Summary */}
                  {log.response?.processedAction && (
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 font-sans text-xs flex items-center justify-between">
                      <span className="font-bold">⚡ Kết quả xử lý:</span>
                      <span>{log.response.processedAction}</span>
                    </div>
                  )}

                  {/* Body Payload */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-semibold block font-sans">📥 Dữ liệu Payload JSON nhận từ Zalo:</span>
                    <pre className="bg-slate-950 text-slate-100 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed max-h-60 select-all">
                      {JSON.stringify(log.body, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
