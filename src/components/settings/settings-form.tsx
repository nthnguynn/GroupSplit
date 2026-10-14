"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Check,
  Key,
  Camera,
  User,
  ShieldCheck,
  Crown,
  Users,
  CreditCard,
  QrCode,
  Sparkles,
  AlertTriangle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Send,
  RefreshCw,
  ArrowRight,
  Bot,
  ShieldAlert,
} from "lucide-react";
import { getInitials } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { BankSelect } from "@/components/ui/bank-select";
import { SepayWizardDialog } from "@/components/settings/sepay-wizard-dialog";
import { ProfileZaloSettings } from "@/components/settings/profile-zalo-settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface UserSettings {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  isEmailVerified?: boolean;
  avatar: string | null;
  zaloChatId: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  sepayWebhookSecret: string | null;
}

export function SettingsForm({ user }: { user: UserSettings }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // States cho thông tin cá nhân & avatar
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [avatarPreview, setAvatarPreview] = useState(user.avatar || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // States cho Email & Đổi Email thông minh
  const [currentEmail, setCurrentEmail] = useState(user.email || "");
  const [isEmailVerified, setIsEmailVerified] = useState(Boolean(user.isEmailVerified));

  // Email Change Modal States
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalStep, setEmailModalStep] = useState<"INPUT" | "VERIFY_OLD" | "VERIFY_NEW">("INPUT");
  const [inputNewEmail, setInputNewEmail] = useState("");
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailActionLoading, setEmailActionLoading] = useState(false);
  const [resendingEmailOtp, setResendingEmailOtp] = useState(false);
  const [modalTargetEmail, setModalTargetEmail] = useState("");

  // States cho Đổi Mật Khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [preferredChannel, setPreferredChannel] = useState<"email" | "zalo">(
    user.email && user.isEmailVerified ? "email" : "zalo"
  );
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Password OTP Modal States
  const [isPasswordOtpModalOpen, setIsPasswordOtpModalOpen] = useState(false);
  const [passwordOtpCode, setPasswordOtpCode] = useState("");
  const [verifyingPasswordOtp, setVerifyingPasswordOtp] = useState(false);
  const [resendingPasswordOtp, setResendingPasswordOtp] = useState(false);
  const [passwordTargetDesc, setPasswordTargetDesc] = useState("");

  // States cho thông tin ngân hàng & sepay
  const [bankName, setBankName] = useState(user.bankName || "");
  const [accountNumber, setAccountNumber] = useState(user.accountNumber || "");
  const [accountName, setAccountName] = useState(user.accountName || "");
  const [sepaySecret, setSepaySecret] = useState(user.sepayWebhookSecret || "");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const hasEmail = Boolean(currentEmail && isEmailVerified);
  const hasZalo = Boolean(user.zaloChatId);
  const isSepayFullyConfigured = Boolean(bankName && accountNumber && accountName && sepaySecret);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = origin ? `${origin}/api/webhook/sepay/${user.id}` : "";

  // Xử lý đổi file ảnh đại diện (Xem trước client-side và gán file)
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Vui lòng chọn ảnh nhỏ hơn 5MB để tối ưu dung lượng!");
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      toast.success("Đã chọn ảnh đại diện mới!");
    }
  }

  async function copyWebhookUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("Đã copy webhook URL cá nhân!");
    setTimeout(() => setCopied(false), 2000);
  }

  // Xử lý lưu thông tin cá nhân & ngân hàng (không đổi email tại đây)
  async function handleSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("displayName", displayName);
    formData.append("bankName", bankName);
    formData.append("accountNumber", accountNumber);
    formData.append("accountName", accountName);
    formData.append("sepayWebhookSecret", sepaySecret || "");
    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        body: formData,
      });

      setLoading(false);
      const data = await res.json();

      if (res.ok) {
        toast.success("Cập nhật thông tin thành công!");
        router.refresh();
      } else {
        toast.error(data.error || "Cập nhật thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // ==========================================
  // XỬ LÝ QUY TRÌNH ĐỔI EMAIL 2 BƯỚC BẢO MẬT
  // ==========================================

  function openEmailChangeDialog() {
    setInputNewEmail("");
    setEmailOtpCode("");
    setEmailModalStep("INPUT");
    setIsEmailModalOpen(true);
  }

  // Gửi yêu cầu đổi email
  async function handleRequestEmailChange(e?: React.FormEvent | React.MouseEvent) {
    if (e) e.preventDefault();
    if (!inputNewEmail || !inputNewEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ Email mới hợp lệ");
      return;
    }

    setEmailActionLoading(true);
    try {
      const res = await fetch("/api/user/email/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: inputNewEmail.trim() }),
      });

      const data = await res.json();
      setEmailActionLoading(false);

      if (res.ok) {
        setEmailModalStep(data.step);
        setModalTargetEmail(data.targetEmail);
        setEmailOtpCode("");
        toast.success(data.message || "Đã gửi mã OTP!");
      } else {
        toast.error(data.error || "Không thể yêu cầu đổi email");
      }
    } catch (err) {
      setEmailActionLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // Xác thực OTP đổi email (Bước 1 hoặc Bước 2)
  async function handleVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOtpCode || emailOtpCode.trim().length !== 6) {
      toast.error("Mã OTP phải gồm đúng 6 chữ số");
      return;
    }

    setEmailActionLoading(true);
    try {
      const res = await fetch("/api/user/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: emailOtpCode.trim() }),
      });

      const data = await res.json();
      setEmailActionLoading(false);

      if (res.ok) {
        if (data.completed) {
          // Hoàn tất đổi email
          toast.success(data.message || "Cập nhật email thành công!");
          setCurrentEmail(data.email);
          setIsEmailVerified(true);
          setIsEmailModalOpen(false);
          setEmailOtpCode("");
          router.refresh();
        } else if (data.step === "VERIFY_NEW") {
          // Chuyển từ bước 1 (xác thực email cũ) sang bước 2 (xác thực email mới)
          toast.success(data.message || "Xác nhận email cũ thành công!");
          setEmailModalStep("VERIFY_NEW");
          setModalTargetEmail(data.targetEmail);
          setEmailOtpCode("");
        }
      } else {
        toast.error(data.error || "Mã OTP không chính xác");
      }
    } catch (err) {
      setEmailActionLoading(false);
      toast.error("Lỗi kết nối khi xác thực OTP");
    }
  }

  // Gửi lại mã OTP đổi email
  async function handleResendEmailOtp() {
    setResendingEmailOtp(true);
    try {
      const res = await fetch("/api/user/email/resend", { method: "POST" });
      const data = await res.json();
      setResendingEmailOtp(false);

      if (res.ok) {
        toast.success(data.message || "Đã gửi lại mã OTP mới!");
      } else {
        toast.error(data.error || "Không thể gửi lại mã OTP");
      }
    } catch (err) {
      setResendingEmailOtp(false);
      toast.error("Lỗi kết nối khi gửi lại mã OTP");
    }
  }

  // ==========================================
  // XỬ LÝ QUY TRÌNH ĐỔI MẬT KHẨU CÓ OTP (EMAIL / ZALO)
  // ==========================================

  // Gửi yêu cầu đổi mật khẩu
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Vui lòng điền đầy đủ các trường mật khẩu");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không trùng khớp");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
          channel: preferredChannel,
        }),
      });

      const data = await res.json();
      setPasswordLoading(false);

      if (res.ok) {
        if (data.requireOtp) {
          // Yêu cầu nhập mã OTP gửi qua Email hoặc Zalo
          setPasswordTargetDesc(data.targetDesc || "kênh bảo mật của bạn");
          setPasswordOtpCode("");
          setIsPasswordOtpModalOpen(true);
          toast.info(data.message || "Vui lòng nhập mã OTP để xác nhận đổi mật khẩu!");
        } else {
          // Đổi mật khẩu thành công ngay (tài khoản chưa setup kênh nào)
          toast.success(data.message || "Đổi mật khẩu thành công!");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      } else {
        toast.error(data.error || "Đổi mật khẩu thất bại");
      }
    } catch (err) {
      setPasswordLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // Xác thực OTP đổi mật khẩu
  async function handleVerifyPasswordOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOtpCode || passwordOtpCode.trim().length !== 6) {
      toast.error("Mã OTP phải gồm đúng 6 chữ số");
      return;
    }

    setVerifyingPasswordOtp(true);
    try {
      const res = await fetch("/api/user/change-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: passwordOtpCode.trim() }),
      });

      const data = await res.json();
      setVerifyingPasswordOtp(false);

      if (res.ok) {
        toast.success(data.message || "Đổi mật khẩu thành công!");
        setIsPasswordOtpModalOpen(false);
        setPasswordOtpCode("");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Mã OTP không chính xác hoặc đã hết hạn");
      }
    } catch (err) {
      setVerifyingPasswordOtp(false);
      toast.error("Lỗi kết nối khi xác thực OTP");
    }
  }

  // Gửi lại OTP đổi mật khẩu
  async function handleResendPasswordOtp() {
    setResendingPasswordOtp(true);
    try {
      const res = await fetch("/api/user/change-password/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: preferredChannel }),
      });
      const data = await res.json();
      setResendingPasswordOtp(false);

      if (res.ok) {
        toast.success(data.message || "Đã gửi lại mã OTP mới!");
      } else {
        toast.error(data.error || "Không thể gửi lại mã OTP");
      }
    } catch (err) {
      setResendingPasswordOtp(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <div className="space-y-6">
      {!isSepayFullyConfigured && (
        <Alert className="border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <AlertTitle className="font-semibold text-sm text-amber-800 dark:text-amber-300">
              Tài khoản chưa hoàn tất kết nối SePay Webhook
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
              Bạn cần điền đầy đủ Thông tin ngân hàng và Webhook Secret Key để có thể làm Trưởng nhóm tạo nhóm chia tiền mới.
            </AlertDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsWizardOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Mở Hướng dẫn Từng bước
          </Button>
        </Alert>
      )}

      <Card className="border">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-4 w-4" />
            Quy định & Hướng dẫn thanh toán
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Chi tiết vai trò và yêu cầu cài đặt thông tin nhận tiền cho từng loại tài khoản
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Trưởng nhóm */}
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
              <Crown className="h-4 w-4 shrink-0" />
              <span>Trưởng nhóm</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              Bắt buộc cấu hình đầy đủ <strong className="text-foreground font-semibold">Thông tin ngân hàng</strong> và <strong className="text-foreground font-semibold">SePay Webhook Secret</strong> để được tạo nhóm. Hệ thống tự động sinh mã VietQR chuẩn và tự động gạch nợ thông qua SePay khi nhận khoản thanh toán.
            </p>
          </div>

          {/* Thành viên */}
          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4 shrink-0" />
              <span>Thành viên nhóm</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              Chỉ cần cập nhật <strong className="text-foreground font-semibold">Ngân hàng & Số tài khoản</strong>. Thông tin này dùng để hiển thị cho Trưởng nhóm hoặc thành viên khác quét mã QR hoặc sao chép khi chuyển khoản trả tiền dư nợ cho bạn.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmitProfile} className="space-y-6">
        {/* Profile Details & Avatar & Email Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4" />
              Thông tin cá nhân & Tài khoản
            </CardTitle>
            <CardDescription className="text-xs">
              Cập nhật ảnh đại diện, tên hiển thị và địa chỉ email nhận thông báo của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar upload wrapper */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group">
                <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-sm">
                  <AvatarImage src={avatarPreview || undefined} alt={displayName} className="object-cover" />
                  <AvatarFallback className="bg-muted text-foreground text-xl">
                    {getInitials(displayName || "U")}
                  </AvatarFallback>
                </Avatar>
                <Label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold gap-1"
                >
                  <Camera className="h-4 w-4" />
                  Thay đổi
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="text-center sm:text-left space-y-1.5 flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <Label htmlFor="display-name" className="text-sm font-semibold">Tên hiển thị của bạn *</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    @{user.username}
                  </span>
                </div>
                <Input
                  id="display-name"
                  placeholder="Nhập tên hiển thị..."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="h-11 font-medium"
                />
                <p className="text-[10px] text-muted-foreground">
                  Hỗ trợ tải lên ảnh đuôi .png, .jpg, .webp dung lượng dưới 5MB.
                </p>
              </div>
            </div>

            {/* Email field with Smart 2-Step Verification Button */}
            <div className="pt-3 border-t space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Địa chỉ Email tài khoản
                </Label>
                {currentEmail ? (
                  isEmailVerified ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-medium gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Đã xác thực
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-medium gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Chưa xác thực
                    </Badge>
                  )
                ) : (
                  <span className="text-[11px] text-muted-foreground">Chưa liên kết email</span>
                )}
              </div>

              {currentEmail ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={currentEmail}
                    readOnly
                    className="h-11 font-medium bg-muted/50 cursor-not-allowed select-all flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openEmailChangeDialog}
                    className="h-11 px-4 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {isEmailVerified ? "Đổi địa chỉ Email" : "Xác thực / Đổi Email"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="VD: nguyenvana@gmail.com"
                    value={inputNewEmail}
                    onChange={(e) => setInputNewEmail(e.target.value)}
                    className="h-11 font-medium flex-1"
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!inputNewEmail) {
                        toast.error("Vui lòng nhập địa chỉ Email");
                        return;
                      }
                      setIsEmailModalOpen(true);
                      await handleRequestEmailChange();
                    }}
                    className="h-11 px-4 text-xs font-bold gap-1.5 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Liên kết & Xác thực Email
                  </Button>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-normal">
                {currentEmail && isEmailVerified ? (
                  <span>
                    🛡️ Để đảm bảo an toàn, khi đổi sang email mới, hệ thống sẽ gửi mã OTP xác nhận tới <strong>{currentEmail}</strong> trước khi kích hoạt email mới.
                  </span>
                ) : (
                  "Email dùng để nhận thông báo, xác thực bảo mật tài khoản và khôi phục mật khẩu khi cần."
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Zalo Personal Notification Settings */}
        <ProfileZaloSettings user={user} />

        {/* Bank Information */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Thông tin nhận tiền & Ngân hàng
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Thông tin ngân hàng thụ hưởng hiển thị khi thành viên chuyển khoản hoặc tạo mã VietQR tự động.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ngân hàng thụ hưởng *</Label>
              <BankSelect value={bankName} onChange={setBankName} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account-number" className="text-sm font-semibold">Số tài khoản *</Label>
                <Input
                  id="account-number"
                  placeholder="VD: 1903456789..."
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
                  required
                  className="h-11 font-mono tracking-wider text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-name" className="text-sm font-semibold">Tên chủ tài khoản (Không dấu) *</Label>
                <Input
                  id="account-name"
                  placeholder="VD: NGUYEN VAN A"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                  required
                  className="h-11 font-semibold uppercase tracking-wide"
                />
              </div>
            </div>

            {/* Live VietQR Card & QR Code Preview */}
            {bankName && accountNumber && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-lg border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Thông tin thẻ */}
                  <div className="space-y-3 flex-1 w-full text-center sm:text-left">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ngân hàng thụ hưởng</p>
                      <p className="text-sm font-bold text-emerald-400">{bankName}</p>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Số tài khoản</p>
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="text-xl font-mono font-black tracking-wider text-white">
                          {accountNumber}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(accountNumber);
                            toast.success("Đã sao chép số tài khoản!");
                          }}
                          className="h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                          title="Sao chép STK"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Chủ tài khoản</p>
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        {accountName || "CHỦ TÀI KHOẢN"}
                      </p>
                    </div>
                  </div>

                  {/* Mã VietQR thực tế */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 bg-white/5 p-3 rounded-xl border border-white/10">
                    <img
                      src={`https://img.vietqr.io/image/${encodeURIComponent(bankName)}-${encodeURIComponent(accountNumber)}-compact2.png?accountName=${encodeURIComponent(accountName || "")}`}
                      alt="Mã VietQR cá nhân"
                      className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg bg-white p-1.5 shadow-md"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mt-1">
                      <QrCode className="h-3 w-3 text-emerald-400" />
                      Quét thử bằng App Bank
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SePay Integration */}
        <Card className="border">
          <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Key className="h-4 w-4 text-primary" />
                Tích hợp SePay Webhook (Dành cho Trưởng nhóm)
              </CardTitle>
              <CardDescription className="text-xs">
                Cấu hình webhook tự động gạch nợ qua SePay (Miễn phí).
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsWizardOpen(true)}
              className="font-medium text-xs gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Xem Hướng dẫn 4 bước
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">1. Đường dẫn Webhook URL cá nhân</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl || "Đang tải..."}
                  readOnly
                  className="text-xs font-mono bg-muted select-all h-11"
                />
                <Button
                  type="button"
                  onClick={copyWebhookUrl}
                  disabled={!webhookUrl}
                  variant="outline"
                  className="h-11 px-3 shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-normal">
                Sao chép link này và dán vào phần <strong className="text-foreground font-semibold">URL webhook</strong> trong trang cấu hình webhook của SePay (lựa chọn phương thức xác thực <strong className="text-foreground font-semibold">HMAC-SHA256</strong>).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sepay-secret" className="text-sm font-semibold">
                2. Webhook Secret Key
              </Label>
              <Input
                id="sepay-secret"
                type="password"
                placeholder="Nhập Secret Key từ SePay..."
                value={sepaySecret}
                onChange={(e) => setSepaySecret(e.target.value.trim())}
                className="h-11 font-mono"
              />
              <p className="text-xs text-muted-foreground leading-normal">
                Khóa bí mật dùng để xác thực dữ liệu webhook được gửi bảo mật từ SePay.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                variant="secondary"
                className="w-full h-10 font-semibold text-xs sm:text-sm gap-2"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                Mở Hướng dẫn Tích hợp Chi tiết (Từng bước)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Submit Main Settings */}
        <Button type="submit" className="w-full h-11 text-base font-bold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu thay đổi...
            </>
          ) : (
            "Lưu cài đặt thông tin cá nhân & ngân hàng"
          )}
        </Button>
      </form>

      {/* Change Password Card Section with OTP support */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Lock className="h-4 w-4 text-primary" />
              Bảo mật & Đổi mật khẩu
            </CardTitle>
            {hasEmail || hasZalo ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold gap-1">
                <ShieldCheck className="h-3 w-3" /> Đã bảo vệ bằng OTP
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold gap-1">
                <AlertTriangle className="h-3 w-3" /> Chưa thiết lập kênh OTP
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Thay đổi mật khẩu đăng nhập để bảo vệ an toàn cho tài khoản của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Cảnh báo nếu chưa có cả Email lẫn Zalo */}
          {!(hasEmail || hasZalo) && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <AlertTitle className="font-bold text-sm text-amber-800 dark:text-amber-300">
                  Yêu cầu thiết lập Kênh bảo mật trước khi đổi mật khẩu
                </AlertTitle>
                <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                  Để đảm bảo an toàn tối đa cho tài khoản, hệ thống yêu cầu bạn phải liên kết ít nhất 1 trong 2 kênh nhận mã OTP: <strong className="text-foreground">Địa chỉ Email đã xác thực</strong> hoặc <strong className="text-foreground">Zalo Bot cá nhân</strong>.
                </AlertDescription>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openEmailChangeDialog}
                    className="h-8 text-xs font-bold gap-1 bg-background text-foreground hover:bg-muted"
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    1. Liên kết Email ngay
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    className="h-8 text-xs font-bold gap-1 bg-background text-foreground hover:bg-muted"
                  >
                    <a href="https://bot.zaloplatforms.com/bots/2019095361100437498" target="_blank" rel="noreferrer">
                      <Bot className="h-3.5 w-3.5 text-blue-500" />
                      2. Kết nối Zalo Bot ngay
                    </a>
                  </Button>
                </div>
              </div>
            </Alert>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-sm font-semibold">
                Mật khẩu hiện tại *
              </Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPw ? "text" : "password"}
                  placeholder="Nhập mật khẩu hiện tại..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={!(hasEmail || hasZalo)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  disabled={!(hasEmail || hasZalo)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-semibold">
                  Mật khẩu mới *
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPw ? "text" : "password"}
                    placeholder="Tối thiểu 6 ký tự..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={!(hasEmail || hasZalo)}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    disabled={!(hasEmail || hasZalo)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-semibold">
                  Xác nhận mật khẩu mới *
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={!(hasEmail || hasZalo)}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    disabled={!(hasEmail || hasZalo)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Tùy chọn kênh nhận OTP (nếu người dùng đã có cả Email và Zalo) */}
            {hasEmail && hasZalo && (
              <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  Chọn kênh nhận mã OTP xác thực đổi mật khẩu:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreferredChannel("email")}
                    className={`flex items-center justify-start gap-2.5 p-3 rounded-lg border font-medium transition-all cursor-pointer text-left ${
                      preferredChannel === "email"
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary/30"
                        : "bg-background border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-xs">1. Nhận qua Email</p>
                      <p className="text-[11px] text-muted-foreground truncate">{currentEmail}</p>
                    </div>
                    {preferredChannel === "email" && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreferredChannel("zalo")}
                    className={`flex items-center justify-start gap-2.5 p-3 rounded-lg border font-medium transition-all cursor-pointer text-left ${
                      preferredChannel === "zalo"
                        ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-xs ring-1 ring-blue-500/30"
                        : "bg-background border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Bot className="h-4 w-4 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-xs">2. Nhận qua Zalo Bot</p>
                      <p className="text-[11px] text-muted-foreground truncate">Chat ID: {user.zaloChatId}</p>
                    </div>
                    {preferredChannel === "zalo" && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                  </button>
                </div>
              </div>
            )}

            {/* Thông báo nếu chỉ có 1 kênh */}
            {!(hasEmail && hasZalo) && (hasEmail || hasZalo) && (
              <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  Mã OTP xác thực sẽ được gửi tự động qua{" "}
                  <strong className="text-foreground">
                    {hasEmail ? `Email (${currentEmail})` : `Zalo Bot (Chat ID: ${user.zaloChatId})`}
                  </strong>
                  .
                </span>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="outline"
                className="w-full sm:w-auto h-10 font-bold text-xs sm:text-sm px-6 bg-primary/5 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
                disabled={passwordLoading || !(hasEmail || hasZalo)}
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi mã OTP...
                  </>
                ) : (
                  "Gửi mã OTP & Đổi mật khẩu"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sepay Setup Wizard Modal */}
      <SepayWizardDialog
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        webhookUrl={webhookUrl}
        bankName={bankName}
        accountNumber={accountNumber}
        accountName={accountName}
        sepaySecret={sepaySecret}
        onUpdateBankName={setBankName}
        onUpdateAccountNumber={setAccountNumber}
        onUpdateAccountName={setAccountName}
        onUpdateSepaySecret={setSepaySecret}
        onSave={async () => {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          await handleSubmitProfile(fakeEvent);
        }}
        loading={loading}
      />

      {/* SMART MULTI-STEP EMAIL CHANGE MODAL */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-md">
          {emailModalStep === "INPUT" && (
            <>
              <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                  <Mail className="h-6 w-6" />
                </div>
                <DialogTitle className="text-center text-lg font-bold">
                  {currentEmail && isEmailVerified ? "Đổi Địa chỉ Email" : "Liên kết Email"}
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-muted-foreground">
                  {currentEmail && isEmailVerified ? (
                    <span>
                      Nhập địa chỉ Email mới bạn muốn liên kết với tài khoản. Hệ thống sẽ gửi mã OTP xác nhận quyền sở hữu.
                    </span>
                  ) : (
                    <span>
                      Nhập địa chỉ Email của bạn để nhận mã kích hoạt và bảo vệ tài khoản.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleRequestEmailChange} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-email-input" className="text-xs font-semibold">
                    Địa chỉ Email mới *
                  </Label>
                  <Input
                    id="new-email-input"
                    type="email"
                    placeholder="VD: emailmoi@gmail.com"
                    value={inputNewEmail}
                    onChange={(e) => setInputNewEmail(e.target.value)}
                    required
                    autoFocus
                    className="h-11 font-medium"
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto font-bold gap-1.5"
                    disabled={emailActionLoading || !inputNewEmail}
                  >
                    {emailActionLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang gửi mã...
                      </>
                    ) : (
                      <>
                        Tiếp tục <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {emailModalStep === "VERIFY_OLD" && (
            <>
              <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mb-2">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="flex justify-center mb-1">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] font-semibold">
                    Bước 1/2: Xác thực Email cũ
                  </Badge>
                </div>
                <DialogTitle className="text-center text-lg font-bold">
                  Xác nhận quyền sở hữu
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
                  Mã OTP xác nhận đã được gửi đến Email hiện tại của bạn: <br />
                  <strong className="font-semibold text-foreground">{modalTargetEmail}</strong>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleVerifyEmailOtp} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="old-otp-input" className="text-xs font-semibold text-center block">
                    Nhập mã OTP 6 chữ số gửi về email cũ
                  </Label>
                  <Input
                    id="old-otp-input"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="h-12 text-center font-mono text-2xl tracking-[0.4em] font-bold"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">Chưa nhận được mã?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendEmailOtp}
                    disabled={resendingEmailOtp}
                    className="h-7 text-xs text-primary hover:text-primary/80 font-medium px-2 gap-1 cursor-pointer"
                  >
                    {resendingEmailOtp ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Gửi lại mã OTP
                  </Button>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEmailModalStep("INPUT")}
                    className="w-full sm:w-auto"
                  >
                    Quay lại
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    disabled={emailActionLoading || emailOtpCode.length !== 6}
                  >
                    {emailActionLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang xác thực...
                      </>
                    ) : (
                      <>
                        Xác nhận bước 1 <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {emailModalStep === "VERIFY_NEW" && (
            <>
              <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex justify-center mb-1">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-semibold">
                    {currentEmail && isEmailVerified ? "Bước 2/2: Kích hoạt Email mới" : "Xác thực Email"}
                  </Badge>
                </div>
                <DialogTitle className="text-center text-lg font-bold">
                  Kích hoạt Email mới
                </DialogTitle>
                <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
                  Mã OTP kích hoạt đã được gửi đến Email mới: <br />
                  <strong className="font-semibold text-emerald-600 dark:text-emerald-400">{modalTargetEmail}</strong>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleVerifyEmailOtp} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-otp-input" className="text-xs font-semibold text-center block">
                    Nhập mã OTP 6 chữ số gửi về email mới
                  </Label>
                  <Input
                    id="new-otp-input"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="h-12 text-center font-mono text-2xl tracking-[0.4em] font-bold"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">Chưa nhận được mã?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendEmailOtp}
                    disabled={resendingEmailOtp}
                    className="h-7 text-xs text-primary hover:text-primary/80 font-medium px-2 gap-1 cursor-pointer"
                  >
                    {resendingEmailOtp ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Gửi lại mã OTP
                  </Button>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={emailActionLoading || emailOtpCode.length !== 6}
                  >
                    {emailActionLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Đang kích hoạt...
                      </>
                    ) : (
                      "Hoàn tất đổi Email"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* PASSWORD CHANGE OTP VERIFICATION DIALOG */}
      <Dialog open={isPasswordOtpModalOpen} onOpenChange={setIsPasswordOtpModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Xác thực Đổi Mật Khẩu
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground leading-relaxed">
              Mã OTP xác thực 6 chữ số đã được gửi qua: <br />
              <strong className="font-semibold text-foreground">{passwordTargetDesc}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyPasswordOtp} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pwd-otp-input" className="text-xs font-semibold text-center block">
                Nhập mã OTP 6 chữ số
              </Label>
              <Input
                id="pwd-otp-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={passwordOtpCode}
                onChange={(e) => setPasswordOtpCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center font-mono text-2xl tracking-[0.4em] font-bold"
                autoFocus
              />
              <p className="text-[11px] text-center text-muted-foreground">
                Mã OTP có hiệu lực trong 15 phút.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-muted-foreground">Chưa nhận được mã?</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResendPasswordOtp}
                disabled={resendingPasswordOtp}
                className="h-7 text-xs text-primary hover:text-primary/80 font-medium px-2 gap-1 cursor-pointer"
              >
                {resendingPasswordOtp ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Gửi lại mã OTP
              </Button>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordOtpModalOpen(false)}
                className="w-full sm:w-auto"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto font-bold"
                disabled={verifyingPasswordOtp || passwordOtpCode.length !== 6}
              >
                {verifyingPasswordOtp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang xác thực...
                  </>
                ) : (
                  "Xác nhận đổi mật khẩu"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
