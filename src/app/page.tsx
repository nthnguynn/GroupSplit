import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/format";
import {
  Users,
  PieChart,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  QrCode,
  Coins,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";

export const metadata = {
  title: "GroupSplit - Chia tiền nhóm dễ dàng",
};

export default async function LandingPage() {
  const session = await auth();
  let dbUser = null;

  if (session?.user?.id) {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-6xl mx-auto items-center justify-between px-4">
          <BrandLogo size="md" href="/" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {dbUser ? (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" asChild className="hidden sm:flex gap-1.5 font-semibold">
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Vào Dashboard
                  </Link>
                </Button>
                <Link href="/settings">
                  <Avatar className="h-8 w-8 border shadow-sm cursor-pointer hover:opacity-85 transition-opacity">
                    {dbUser.avatar && (
                      <AvatarImage src={dbUser.avatar} alt={dbUser.displayName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {getInitials(dbUser.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild className="font-medium">
                  <Link href="/login">Đăng nhập</Link>
                </Button>
                <Button size="sm" asChild className="font-semibold shadow-md shadow-primary/10">
                  <Link href="/register">Đăng ký</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden max-w-6xl mx-auto w-full">
        {/* Background decorative glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-40 left-1/3 -z-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <Badge variant="secondary" className="mb-4 gap-1.5 py-1 px-3 bg-primary/10 text-primary border-none shadow-none font-bold text-xs uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Phiên bản 2.0 đã ra mắt
        </Badge>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl leading-tight">
          Chia tiền nhóm thông minh <br />
          <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Không còn nỗi lo tính toán
          </span>
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Tự động phân bổ hóa đơn, quản lý chi tiêu nhóm, thiết lập quỹ ăn uống chung và chuyển khoản qua mã VietQR thông minh. Minh bạch, nhanh gọn cho mọi cuộc vui.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-xs sm:max-w-none">
          {dbUser ? (
            <Button size="lg" asChild className="gap-2 px-8 py-6 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all">
              <Link href="/dashboard">
                Vào Dashboard ứng dụng
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild className="gap-2 px-8 py-6 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all">
                <Link href="/register">
                  Trải nghiệm miễn phí ngay
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8 py-6 text-base font-semibold bg-background/50">
                <Link href="/login">Đăng nhập tài khoản</Link>
              </Button>
            </>
          )}
        </div>

        {/* Features Showcase Grid */}
        <div className="mt-24 w-full">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Tính năng nổi bật chuyên biệt</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">Thiết kế tinh gọn, tập trung hoàn toàn vào trải nghiệm chia sẻ hóa đơn nhóm thực tế.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {/* Feature 1 */}
            <div className="rounded-2xl border bg-card/50 backdrop-blur p-6 hover:shadow-lg transition-all hover:-translate-y-1 duration-300">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <PieChart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-base mb-2">Chia hóa đơn linh hoạt</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Hỗ trợ chia đều cho cả nhóm hoặc chia riêng biệt từng người theo **Số tiền cụ thể** hoặc **Tỷ lệ phần trăm (%)** tùy chỉnh.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border bg-card/50 backdrop-blur p-6 hover:shadow-lg transition-all hover:-translate-y-1 duration-300">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <Coins className="h-6 w-6 text-blue-500" />
              </div>
              <h3 className="font-bold text-base mb-2">Quản lý quỹ nhóm</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Cấp tiền quỹ hàng ngày/tuần cho thành viên ăn chung hoặc ăn riêng. Hệ thống tự động tính toán dư nợ và cấn trừ thông minh.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border bg-card/50 backdrop-blur p-6 hover:shadow-lg transition-all hover:-translate-y-1 duration-300">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <QrCode className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="font-bold text-base mb-2">Quét mã VietQR</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tự động sinh mã VietQR chuyển khoản kèm nội dung mã hóa đơn. Xác thực thanh toán tự động qua kết nối SePay.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border bg-card/50 backdrop-blur p-6 hover:shadow-lg transition-all hover:-translate-y-1 duration-300">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="font-bold text-base mb-2">Real-time đa nền tảng</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Đồng bộ hóa tức thì các hóa đơn mới, thay đổi quỹ, hay trạng thái xác nhận chuyển khoản mà không cần làm mới trang.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="mt-20 py-8 border-y w-full grid grid-cols-2 md:grid-cols-4 gap-8 bg-muted/20 rounded-2xl px-6">
          <div className="text-center">
            <h4 className="text-2xl sm:text-3xl font-extrabold text-primary">100%</h4>
            <p className="text-xs text-muted-foreground mt-1">Bảo mật & Minh bạch</p>
          </div>
          <div className="text-center">
            <h4 className="text-2xl sm:text-3xl font-extrabold text-blue-500">0đ</h4>
            <p className="text-xs text-muted-foreground mt-1">Hoàn toàn miễn phí</p>
          </div>
          <div className="text-center">
            <h4 className="text-2xl sm:text-3xl font-extrabold text-indigo-500">VietQR</h4>
            <p className="text-xs text-muted-foreground mt-1">Chuyển khoản 1 chạm</p>
          </div>
          <div className="text-center">
            <h4 className="text-2xl sm:text-3xl font-extrabold text-emerald-500">Real-time</h4>
            <p className="text-xs text-muted-foreground mt-1">Thông báo tức thời</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground bg-muted/10">
        <div className="container max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between px-4 gap-4">
          <BrandLogo size="sm" href="/" />
          <p>© {new Date().getFullYear()} GroupSplit. Made with ❤️ to simplify expense sharing.</p>
        </div>
      </footer>
    </div>
  );
}
