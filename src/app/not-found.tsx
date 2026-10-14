"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      {/* Theme Toggle at the top right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Header logo */}
      <div className="absolute top-6 left-6 flex items-center select-none">
        <BrandLogo size="md" href="/" />
      </div>

      {/* Main card */}
      <div className="z-10 flex flex-col items-center max-w-md w-full px-6 py-12 md:p-12 mx-4 text-center rounded-3xl border border-border/50 bg-card/65 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:shadow-primary/5 hover:border-primary/20">
        
        {/* Floating animated icon container */}
        <div className="relative w-24 h-24 rounded-2xl bg-primary/5 flex items-center justify-center mb-8 border border-primary/10 shadow-inner group">
          <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg scale-75 group-hover:scale-100 transition-all duration-300" />
          <FileQuestion className="h-12 w-12 text-primary relative animate-bounce" style={{ animationDuration: '3s' }} />
        </div>

        {/* 404 Status */}
        <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground to-muted-foreground/60 mb-2 select-none">
          404
        </h1>

        {/* Error message */}
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">
          Không tìm thấy trang
        </h2>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển sang một đường dẫn khác.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="w-full sm:w-auto gap-2 h-10 px-4 hover:bg-accent/80 active:scale-95 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto gap-2 h-10 px-5 active:scale-95 transition-all"
          >
            <Link href="/">
              <Home className="h-4 w-4" />
              Về Trang chủ
            </Link>
          </Button>
        </div>
      </div>

      {/* Simple footer */}
      <div className="absolute bottom-6 text-center text-xs text-muted-foreground select-none">
        © {new Date().getFullYear()} GroupSplit. Làm với ❤️ để việc chia tiền dễ hơn.
      </div>
    </div>
  );
}
