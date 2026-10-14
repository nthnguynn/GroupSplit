import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  href?: string;
}

export function BrandLogo({
  size = "md",
  showText = true,
  className,
  href,
}: BrandLogoProps) {
  const sizeMap = {
    sm: { img: 26, text: "text-base", gap: "gap-2" },
    md: { img: 32, text: "text-lg", gap: "gap-2.5" },
    lg: { img: 40, text: "text-xl", gap: "gap-3" },
    xl: { img: 52, text: "text-2xl", gap: "gap-3.5" },
  };

  const currentSize = sizeMap[size];

  const content = (
    <div className={cn("flex items-center select-none font-bold tracking-tight", currentSize.gap, className)}>
      <div className="relative shrink-0 flex items-center justify-center">
        <Image
          src="/logo1.png"
          alt="GroupSplit Logo"
          width={currentSize.img * 2}
          height={currentSize.img * 2}
          className="h-auto w-auto object-contain"
          style={{ width: `${currentSize.img}px`, height: `${currentSize.img}px` }}
          unoptimized
          priority
        />
      </div>
      {showText && (
        <span className={cn("font-bold tracking-tight", currentSize.text)}>
          <span className="text-foreground">Group</span>
          <span className="text-primary">Split</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
