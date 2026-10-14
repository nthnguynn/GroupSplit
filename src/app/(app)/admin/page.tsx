"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  Mail,
  Users,
  Send,
  Lock,
  UserCheck,
  UserX,
  Search,
  Building2,
  Receipt,
  ArrowRightLeft,
  Bot,
  RefreshCw,
  Sparkles,
  Zap,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { getInitials } from "@/lib/utils/format";

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isEmailVerified: boolean;
  role: "ADMIN" | "USER";
  avatar: string | null;
  createdAt: string;
  _count: {
    ownedGroups: number;
    groupMemberships: number;
    paidExpenses: number;
  };
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalGroups: 0,
    totalExpenses: 0,
    totalSettlements: 0,
  });

  const [resend, setResend] = useState({
    apiKey: "",
    from: "GroupSplit <support@qy286.me>",
  });

  const [smtp, setSmtp] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    from: "",
    secure: false,
  });

  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Lấy thông tin admin stats & Email
  async function fetchAdminData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system");
      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        setStats(data.stats);
        if (data.resend) {
          setResend({
            apiKey: data.resend.apiKey || "",
            from: data.resend.from || "GroupSplit <support@qy286.me>",
          });
        }
        if (data.smtp) {
          setSmtp({
            host: data.smtp.host || "",
            port: String(data.smtp.port || "587"),
            user: data.smtp.user || "",
            pass: data.smtp.pass || "",
            from: data.smtp.from || "",
            secure: data.smtp.secure === "true",
          });
        }
      } else {
        toast.error(data.error || "Không thể tải dữ liệu Admin");
      }
    } catch (err) {
      setLoading(false);
    }
  }

  // Lấy danh sách người dùng
  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Fetch users error:", err);
    }
  }

  useEffect(() => {
    fetchAdminData();
    fetchUsers();
  }, []);

  // Lưu cấu hình Email (Resend & SMTP)
  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);

    try {
      const res = await fetch("/api/admin/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resendApiKey: resend.apiKey,
          resendFrom: resend.from,
          ...smtp,
        }),
      });

      const data = await res.json();
      setSavingEmail(false);

      if (res.ok) {
        toast.success(data.message || "Đã lưu cấu hình Email thành công!");
      } else {
        toast.error(data.error || "Lưu cấu hình thất bại");
      }
    } catch (err) {
      setSavingEmail(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // Gửi Email thử nghiệm
  async function handleTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmailAddr) {
      toast.error("Vui lòng nhập Email người nhận thử nghiệm");
      return;
    }

    setTestingEmail(true);
    try {
      const res = await fetch("/api/admin/system/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: testEmailAddr }),
      });

      const data = await res.json();
      setTestingEmail(false);

      if (res.ok) {
        toast.success(data.message || "Gửi Email thử nghiệm thành công!");
      } else {
        toast.error(data.error || "Gửi Email thử nghiệm thất bại");
      }
    } catch (err) {
      setTestingEmail(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // Thao tác Admin trên tài khoản người dùng
  async function handleUpdateUser(userId: string, updatePayload: any) {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updatePayload }),
      });

      const data = await res.json();
      setUpdatingUserId(null);

      if (res.ok) {
        toast.success(data.message || "Cập nhật thành công!");
        fetchUsers();
      } else {
        toast.error(data.error || "Thao tác thất bại");
      }
    } catch (err) {
      setUpdatingUserId(null);
      toast.error("Lỗi máy chủ");
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-rose-600" />
            <h1 className="text-2xl font-bold tracking-tight">Hệ thống Quản trị Admin (`qy286`)</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Quản lý cấu hình Email (Resend / SMTP), tài khoản người dùng và bảo mật hệ thống.
          </p>
        </div>
        <Button onClick={fetchAdminData} variant="outline" size="sm" className="gap-1.5 shrink-0 font-semibold">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </Button>
      </div>

      {/* System Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Người dùng</p>
              <p className="text-xl font-bold">{stats.totalUsers}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Nhóm chia tiền</p>
              <p className="text-xl font-bold">{stats.totalGroups}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Khoản chi</p>
              <p className="text-xl font-bold">{stats.totalExpenses}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Quyết toán</p>
              <p className="text-xl font-bold">{stats.totalSettlements}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Admin Tabs */}
      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email" className="gap-1.5 text-xs sm:text-sm font-semibold">
            <Mail className="h-4 w-4 text-blue-500" /> Cấu hình Email (Resend / SMTP)
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm font-semibold">
            <Users className="h-4 w-4 text-purple-500" /> Quản lý Người dùng
          </TabsTrigger>
          <TabsTrigger value="zalo" className="gap-1.5 text-xs sm:text-sm font-semibold">
            <Bot className="h-4 w-4 text-emerald-500" /> Zalo Inspector
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Cấu hình Email */}
        <TabsContent value="email" className="space-y-4">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Cấu hình Dịch vụ Gửi Email (Resend & SMTP)
              </CardTitle>
              <CardDescription className="text-xs">
                Email này sẽ được sử dụng để gửi mã OTP xác thực đăng ký, xác thực tài khoản và khôi phục mật khẩu.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSaveEmail} className="space-y-6">
                {/* 1. Resend API Config (Ưu tiên) */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-blue-700 dark:text-blue-300">
                      <Zap className="h-4 w-4" />
                      1. Cấu hình Resend API (Khuyên dùng - Nhanh & Tin cậy)
                    </div>
                    {resend.apiKey ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                        Đang kích hoạt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Chưa cấu hình
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resendApiKey">Resend API Key</Label>
                      <Input
                        id="resendApiKey"
                        type="password"
                        placeholder="re_xxxxxxxxxxxx..."
                        value={resend.apiKey}
                        onChange={(e) => setResend({ ...resend, apiKey: e.target.value.trim() })}
                        className="h-11 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Lấy API key tại trang quản lý <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-primary underline">Resend API Keys</a>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="resendFrom">Email Người gửi (From Header)</Label>
                      <Input
                        id="resendFrom"
                        placeholder="GroupSplit <support@qy286.me>"
                        value={resend.from}
                        onChange={(e) => setResend({ ...resend, from: e.target.value })}
                        className="h-11"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Sử dụng domain đã xác thực trên Resend (VD: support@qy286.me).
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. SMTP Server Config (Dự phòng) */}
                <div className="p-4 rounded-xl border border-muted-foreground/20 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Mail className="h-4 w-4" />
                      2. Cấu hình Máy chủ SMTP (Dự phòng fallback)
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.gmail.com"
                        value={smtp.host}
                        onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        value={smtp.port}
                        onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
                        className="h-11 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpUser">SMTP User / Email đăng nhập</Label>
                      <Input
                        id="smtpUser"
                        type="email"
                        placeholder="your-email@gmail.com"
                        value={smtp.user}
                        onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtpPass">SMTP Password / Mật khẩu ứng dụng</Label>
                      <Input
                        id="smtpPass"
                        type="password"
                        placeholder="••••••••••••"
                        value={smtp.pass}
                        onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtpFrom">Email Người gửi SMTP</Label>
                    <Input
                      id="smtpFrom"
                      placeholder="GroupSplit App <no-reply@yourdomain.com>"
                      value={smtp.from}
                      onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                      className="h-11"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <Switch
                      id="smtpSecure"
                      checked={smtp.secure}
                      onCheckedChange={(val) => setSmtp({ ...smtp, secure: val })}
                    />
                    <Label htmlFor="smtpSecure" className="text-xs font-semibold cursor-pointer">
                      Sử dụng kết nối bảo mật SSL/TLS (Cổng 465)
                    </Label>
                  </div>
                </div>

                <Button type="submit" disabled={savingEmail} className="font-bold gap-2 h-11 bg-blue-600 hover:bg-blue-700">
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Lưu Cấu hình Email
                </Button>
              </form>

              {/* Form Gửi thử nghiệm */}
              <div className="pt-6 border-t space-y-3">
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <Send className="h-4 w-4 text-emerald-500" />
                  Gửi Email Thử nghiệm (Test Send Email)
                </h4>

                <form onSubmit={handleTestEmail} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="Nhập email người nhận thử nghiệm..."
                    value={testEmailAddr}
                    onChange={(e) => setTestEmailAddr(e.target.value)}
                    required
                    className="h-11 flex-1"
                  />
                  <Button type="submit" disabled={testingEmail} variant="outline" className="h-11 font-semibold gap-1.5">
                    {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-emerald-500" />}
                    Gửi Email Test
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Quản lý Người dùng */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Danh sách Người dùng ({users.length})
                  </CardTitle>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo tên, username, email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Không tìm thấy người dùng nào phù hợp.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isCurAdmin = u.username === "qy286";
                  const isUpdating = updatingUserId === u.id;

                  return (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-xl border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all hover:bg-muted/30"
                    >
                      {/* Avatar & User Details */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                          <AvatarImage src={u.avatar || undefined} />
                          <AvatarFallback className="text-xs bg-muted font-bold">
                            {getInitials(u.displayName || u.username)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {u.displayName}
                            </span>
                            <span className="font-mono text-muted-foreground text-[11px]">
                              @{u.username}
                            </span>
                            {u.role === "ADMIN" ? (
                              <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] h-5">
                                ADMIN
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                                USER
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground text-[11px] flex-wrap">
                            <span>{u.email || "Chưa có email"}</span>
                            {u.email && (
                              <span className={u.isEmailVerified ? "text-emerald-500" : "text-amber-500"}>
                                ({u.isEmailVerified ? "Đã xác thực" : "Chưa xác thực"})
                              </span>
                            )}
                            <span>• {u._count.ownedGroups} nhóm tạo</span>
                            <span>• {u._count.groupMemberships} nhóm tham gia</span>
                          </div>
                        </div>
                      </div>

                      {/* Admin Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {!isCurAdmin && (
                          <>
                            {/* Toggle Email Verified */}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdateUser(u.id, {
                                  isEmailVerified: !u.isEmailVerified,
                                })
                              }
                              className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                              title={u.isEmailVerified ? "Hủy xác thực Email" : "Đánh dấu đã xác thực Email"}
                            >
                              {u.isEmailVerified ? <UserX className="h-3.5 w-3.5 text-amber-500" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-500" />}
                            </Button>

                            {/* Reset Password Prompt */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isUpdating}
                              onClick={() => {
                                const newPass = window.prompt(
                                  `Nhập mật khẩu mới cho tài khoản @${u.username}:`,
                                  "123456"
                                );
                                if (newPass && newPass.trim().length >= 6) {
                                  handleUpdateUser(u.id, { newPassword: newPass.trim() });
                                } else if (newPass !== null) {
                                  toast.error("Mật khẩu tối thiểu 6 ký tự");
                                }
                              }}
                              className="h-8 text-xs gap-1 font-medium"
                            >
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              Reset Pass
                            </Button>

                            {/* Toggle Role */}
                            <Button
                              size="sm"
                              variant={u.role === "ADMIN" ? "destructive" : "secondary"}
                              disabled={isUpdating}
                              onClick={() =>
                                handleUpdateUser(u.id, {
                                  role: u.role === "ADMIN" ? "USER" : "ADMIN",
                                })
                              }
                              className="h-8 text-xs font-semibold"
                            >
                              {u.role === "ADMIN" ? "Hạ cấp User" : "Set Admin"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Zalo Bot Inspector */}
        <TabsContent value="zalo" className="space-y-4">
          <Card className="border bg-blue-500/5 border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Bot className="h-5 w-5" />
                Zalo Bot Realtime Inspector (`/zalo-helper`)
              </CardTitle>
              <CardDescription className="text-xs">
                Trang kiểm tra Webhook Zalo Bot dành riêng cho Quản trị viên (ADMIN).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2 font-bold bg-blue-600 hover:bg-blue-700">
                <Link href="/zalo-helper">
                  Mở trang Zalo Bot Inspector ngay
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
