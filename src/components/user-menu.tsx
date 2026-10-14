"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";
import { getInitials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user: {
    name?: string | null;
    username?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative h-8 w-8 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <Avatar className="h-8 w-8 border">
          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} className="object-cover" />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {getInitials(user.name ?? "U")}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Wrap DropdownMenuLabel in DropdownMenuGroup to fix Base UI context requirement */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground font-mono">
                @{user.username ?? ""}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem className="p-0 cursor-pointer">
            <Link href="/settings" className="flex items-center w-full px-1.5 py-1 text-sm">
              <Settings className="mr-2 h-4 w-4" />
              <span>Cập nhật tài khoản</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Đăng xuất</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
