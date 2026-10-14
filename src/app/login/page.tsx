import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = {
  title: "Đăng nhập - GroupSplit",
  description: "Đăng nhập vào GroupSplit để quản lý chi tiêu nhóm",
};

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-2">
            <BrandLogo size="lg" href="/" />
          </div>
          <h1 className="text-2xl font-bold mt-4">Chào mừng trở lại</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Đăng nhập để tiếp tục
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-muted-foreground mt-6">
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
