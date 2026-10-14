"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BankSelect } from "@/components/ui/bank-select";
import { toast } from "sonner";
import {
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Building2,
  Info,
  Zap,
  Image as ImageIcon,
} from "lucide-react";

interface SepayWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookUrl: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  sepaySecret: string;
  onUpdateBankName: (val: string) => void;
  onUpdateAccountNumber: (val: string) => void;
  onUpdateAccountName: (val: string) => void;
  onUpdateSepaySecret: (val: string) => void;
  onSave: () => Promise<void> | void;
  loading?: boolean;
}

export function SepayWizardDialog({
  open,
  onOpenChange,
  webhookUrl,
  bankName,
  accountNumber,
  accountName,
  sepaySecret,
  onUpdateBankName,
  onUpdateAccountNumber,
  onUpdateAccountName,
  onUpdateSepaySecret,
  onSave,
  loading = false,
}: SepayWizardDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const totalSteps = 4;

  const handleCopyUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success("Đã sao chép Webhook URL cá nhân!");
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const isStep2Valid = bankName.trim() !== "" && accountNumber.trim() !== "" && accountName.trim() !== "";
  const isStep3Valid = sepaySecret.trim() !== "";

  const handleNext = () => {
    if (currentStep === 2 && !isStep2Valid) {
      toast.error("Vui lòng điền đầy đủ Thông tin ngân hàng trước khi tiếp tục!");
      return;
    }
    if (currentStep === 3 && !isStep3Valid) {
      toast.error("Vui lòng nhập Webhook Secret Key nhận được từ SePay!");
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinishAndSave = async () => {
    if (!isStep2Valid) {
      toast.error("Thông tin ngân hàng chưa hoàn tất!");
      setCurrentStep(2);
      return;
    }
    if (!isStep3Valid) {
      toast.error("Webhook Secret chưa được nhập!");
      setCurrentStep(3);
      return;
    }
    await onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 gap-6 border-border">
        {/* Header */}
        <DialogHeader className="space-y-1.5 border-b pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-medium gap-1 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> Hướng dẫn tích hợp SePay
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              Bước <strong className="text-foreground font-bold">{currentStep}</strong> / {totalSteps}
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {currentStep === 1 && "Bước 1: Tạo tài khoản SePay"}
            {currentStep === 2 && "Bước 2: Cấu hình thông tin Ngân hàng"}
            {currentStep === 3 && "Bước 3: Tạo Webhook trên SePay"}
            {currentStep === 4 && "Bước 4: Kiểm tra & Hoàn tất cài đặt"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            {currentStep === 1 && "Tạo tài khoản SePay để tự động nhận thông báo chuyển khoản khi ai đó quét mã VietQR."}
            {currentStep === 2 && "Cung cấp số tài khoản nhận tiền để Group Split tự động tạo mã VietQR chuẩn xác."}
            {currentStep === 3 && "Kết nối đường dẫn Webhook của Group Split vào SePay và copy khóa bảo mật về ứng dụng."}
            {currentStep === 4 && "Xác nhận lại toàn bộ thông tin và hoàn tất tích hợp tự động gạch nợ."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar & Stepper Indicator (Flat Minimalist design) */}
        <div className="w-full space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((step) => {
              const isActive = step === currentStep;
              const isDone = step < currentStep;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (step < currentStep || (step === 2 && isStep2Valid) || (step === 3 && isStep2Valid)) {
                      setCurrentStep(step);
                    }
                  }}
                  className={`h-1.5 rounded-full transition-colors ${
                    isActive
                      ? "bg-primary"
                      : isDone
                      ? "bg-emerald-600 dark:bg-emerald-500"
                      : "bg-muted"
                  }`}
                  title={`Đến bước ${step}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground px-0.5 font-medium">
            <span className={currentStep === 1 ? "font-bold text-foreground" : ""}>1. Tạo TK</span>
            <span className={currentStep === 2 ? "font-bold text-foreground" : ""}>2. Ngân hàng</span>
            <span className={currentStep === 3 ? "font-bold text-foreground" : ""}>3. Webhook</span>
            <span className={currentStep === 4 ? "font-bold text-foreground" : ""}>4. Hoàn tất</span>
          </div>
        </div>

        {/* STEP CONTENT CONTAINER */}
        <div className="py-2">
          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in-50 duration-200">
              <div className="space-y-4">
                <div className="bg-muted/40 border rounded-xl p-4 space-y-2.5">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    SePay là gì & vì sao nên dùng?
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    SePay giúp tự động hóa nhận tiền qua chuyển khoản VietQR. Khi ai đó quét mã trả tiền, SePay gửi thông báo bảo mật để ứng dụng <strong className="text-foreground">gạch nợ tự động ngay lập tức</strong> mà không cần xác nhận tay.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary" /> Hướng dẫn tạo tài khoản SePay:
                  </h4>
                  <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4 leading-relaxed">
                    <li>
                      Bấm nút <strong className="text-foreground">"Mở trang đăng ký my.sepay.vn"</strong> bên dưới.
                    </li>
                    <li>
                      Tạo tài khoản miễn phí bằng Email hoặc tài khoản Google/Facebook.
                    </li>
                    <li>
                      Xác nhận email và đăng nhập vào bảng điều khiển (Dashboard SePay).
                    </li>
                  </ol>
                </div>

                {/* Action Link (Flat button style) */}
                <div className="pt-2">
                  <a
                    href="https://my.sepay.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors group"
                  >
                    <span>Mở trang đăng ký my.sepay.vn</span>
                    <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Screenshot Visual Placeholder */}
              <div className="border border-dashed rounded-xl p-6 bg-muted/20 text-center space-y-3 flex flex-col items-center justify-center min-h-[250px]">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-semibold text-foreground">
                    [Ảnh minh họa: Trang Đăng ký my.sepay.vn]
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Giao diện đăng ký tài khoản SePay đơn giản và miễn phí.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in-50 duration-200">
              <div className="space-y-4">
                <Alert className="bg-muted/40 border text-xs">
                  <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <AlertTitle className="font-semibold text-foreground text-xs">Kết nối ngân hàng thụ hưởng</AlertTitle>
                    <AlertDescription className="text-muted-foreground mt-0.5 leading-relaxed">
                      Thông tin ngân hàng điền bên dưới phải <strong className="text-foreground">chính xác tuyệt đối</strong> để hệ thống tạo mã VietQR chuẩn cho các thành viên quét trả nợ.
                    </AlertDescription>
                  </div>
                </Alert>

                <div className="space-y-3 bg-card border rounded-xl p-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" /> Thông tin Ngân hàng nhận tiền:
                  </h4>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Tên Ngân hàng *</Label>
                      <BankSelect value={bankName} onChange={onUpdateBankName} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wiz-acc-num" className="text-xs font-semibold">Số tài khoản ngân hàng *</Label>
                      <Input
                        id="wiz-acc-num"
                        placeholder="Ví dụ: 0123456789"
                        value={accountNumber}
                        onChange={(e) => onUpdateAccountNumber(e.target.value.trim())}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="wiz-acc-name" className="text-xs font-semibold">Tên chủ tài khoản (Viết hoa không dấu) *</Label>
                      <Input
                        id="wiz-acc-name"
                        placeholder="Ví dụ: NGUYEN VAN A"
                        value={accountName}
                        onChange={(e) => onUpdateAccountName(e.target.value.toUpperCase())}
                        className="h-9 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Supported banks list note */}
                <div className="bg-card border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs border-b pb-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Ngân hàng hỗ trợ biến động số dư:
                    </span>
                    <Badge variant="secondary" className="text-[10px]">Miễn phí</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hỗ trợ hầu hết ngân hàng tại Việt Nam (MBBank, TPBank, VietinBank, VPBank, ACB, Vietcombank, BIDV, OCB, Techcombank...).
                  </p>
                </div>

                {/* Screenshot Visual Placeholder */}
                <div className="border border-dashed rounded-xl p-5 bg-muted/20 text-center space-y-2 flex flex-col items-center justify-center min-h-[180px]">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-semibold text-foreground">
                      [Ảnh minh họa: Mục Ngân Hàng trên SePay]
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Thêm tài khoản ngân hàng trên SePay trùng khớp với thông tin đã nhập.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in-50 duration-200">
              <div className="space-y-4">
                <div className="space-y-2 bg-card border rounded-xl p-4">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">1</span>
                    Sao chép URL Webhook của bạn:
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl || "Đang tạo URL..."}
                      readOnly
                      className="text-xs font-mono bg-muted select-all h-9"
                    />
                    <Button
                      type="button"
                      onClick={handleCopyUrl}
                      disabled={!webhookUrl}
                      variant="secondary"
                      className="h-9 px-3 shrink-0 font-medium text-xs"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 bg-card border rounded-xl p-4">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">2</span>
                    Dán Secret Key nhận được vào đây:
                  </h4>
                  <Input
                    type="password"
                    placeholder="Nhập hoặc dán Webhook Secret Key từ SePay..."
                    value={sepaySecret}
                    onChange={(e) => onUpdateSepaySecret(e.target.value.trim())}
                    className="h-9 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Khóa bí mật dùng để xác thực an toàn dữ liệu gửi từ SePay.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-muted/40 rounded-xl p-4 border space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">!</span>
                    Các bước cài đặt trên SePay:
                  </h4>
                  <ul className="space-y-1.5 list-disc pl-4">
                    <li>
                      Vào <strong className="text-foreground">my.sepay.vn</strong> -&gt; chọn <strong className="text-foreground">Webhooks</strong> -&gt; bấm <strong className="text-foreground">Thêm Webhook</strong>.
                    </li>
                    <li>
                      Dán đường dẫn URL vừa copy ở trên vào ô <strong className="text-foreground">URL Webhook</strong>.
                    </li>
                    <li>
                      Chọn Phương thức xác thực: <Badge variant="outline" className="font-mono text-[10px]">HMAC-SHA256</Badge>.
                    </li>
                    <li>
                      Nhấn <strong className="text-foreground">Lưu Webhook</strong> và copy <strong className="text-foreground">Secret Key</strong> dán lại sang đây.
                    </li>
                  </ul>
                </div>

                {/* Screenshot Visual Placeholder */}
                <div className="border border-dashed rounded-xl p-4 bg-muted/20 text-center space-y-2 flex flex-col items-center justify-center min-h-[130px]">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    [Ảnh minh họa: Cấu hình Webhook SePay]
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="bg-muted/40 border rounded-xl p-4 text-center space-y-1.5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">Bạn đã sẵn sàng hoàn tất!</h4>
                <p className="text-xs text-muted-foreground">
                  Vui lòng kiểm tra lại thông tin cài đặt bên dưới trước khi bấm lưu.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border rounded-xl divide-y text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Ngân hàng:</span>
                    <span className="font-semibold text-foreground">{bankName || "Chưa chọn"}</span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Số tài khoản:</span>
                    <span className="font-mono font-semibold text-foreground">{accountNumber || "Chưa nhập"}</span>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Chủ tài khoản:</span>
                    <span className="font-mono font-semibold text-foreground uppercase">{accountName || "Chưa nhập"}</span>
                  </div>
                </div>

                <div className="bg-card border rounded-xl divide-y text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Webhook URL:</span>
                    <Badge variant="outline" className="font-mono text-[10px] max-w-[180px] truncate">
                      {webhookUrl}
                    </Badge>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-muted-foreground">Secret Key:</span>
                    {sepaySecret ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> Đã nhập Secret
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Chưa nhập Secret</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Alert className="bg-muted/40 border text-xs">
                <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <AlertTitle className="font-semibold text-foreground text-xs">Xác nhận tự động gạch nợ</AlertTitle>
                  <AlertDescription className="text-muted-foreground mt-0.5 leading-relaxed">
                    Sau khi bấm **Hoàn tất & Lưu cài đặt**, khi người khác quét mã QR chuyển khoản đúng nội dung hóa đơn, SePay sẽ tự động gạch nợ thành công cho bạn.
                  </AlertDescription>
                </div>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <DialogFooter className="flex flex-row items-center justify-between border-t pt-4 gap-2">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={loading}
              className="h-9 text-xs font-medium gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Quay lại
            </Button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-9 px-4 text-xs font-semibold gap-1 ml-auto"
            >
              Tiếp theo <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinishAndSave}
              disabled={loading || !isStep2Valid || !isStep3Valid}
              className="h-9 px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 ml-auto"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {loading ? "Đang lưu cài đặt..." : "Hoàn tất & Lưu cài đặt"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
