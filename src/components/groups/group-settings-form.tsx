"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/format";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2, Settings, Camera, SendHorizontal, HelpCircle, ExternalLink } from "lucide-react";
import { CategorySettings } from "./category-settings";

interface GroupSettingsFormProps {
  group: {
    id: string;
    name: string;
    description: string | null;
    avatar: string | null;
    zaloChatId: string | null;
  };
}

export function GroupSettingsForm({ group }: GroupSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(group.avatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Vui lòng chọn ảnh nhỏ hơn 5MB để tối ưu dung lượng!");
        return;
      }

      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      toast.success("Đã chọn ảnh đại diện nhóm mới!");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên nhóm không được để trống");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        body: formData,
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success("Đã cập nhật thông tin nhóm thành công!");
        router.refresh();
      } else {
        toast.error(data.error || "Cập nhật thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  const hasChanges =
    name !== group.name ||
    description !== (group.description || "") ||
    avatarFile !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Cài đặt thông tin nhóm
          </CardTitle>
          <CardDescription className="text-xs">
            Thay đổi ảnh đại diện, tên nhóm, mô tả và cấu hình kết nối Zalo Bot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar and Name */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative group shrink-0">
                <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-sm">
                  <AvatarImage src={avatarPreview || undefined} alt={name} className="object-cover" />
                  <AvatarFallback className="bg-muted text-foreground text-xl font-bold">
                    {getInitials(name || "G")}
                  </AvatarFallback>
                </Avatar>
                <Label
                  htmlFor="group-avatar-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold gap-1"
                >
                  <Camera className="h-4 w-4" />
                  Thay đổi
                </Label>
                <input
                  id="group-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-1.5 flex-1 w-full">
                <Label htmlFor="group-name" className="text-sm font-semibold">Tên nhóm *</Label>
                <Input
                  id="group-name"
                  placeholder="Nhập tên nhóm..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 font-medium"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="group-desc" className="text-sm font-semibold">Mô tả nhóm</Label>
              <Input
                id="group-desc"
                placeholder="Nhập mô tả nhóm (ví dụ: Quỹ ăn trưa phòng IT)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-11"
              />
            </div>

            {/* Zalo Notification Setting Info Banner */}
            <div className="pt-2 border-t space-y-2">
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    💙 Thông báo Zalo Cá nhân
                  </span>
                  <Link
                    href="/settings"
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Vào Cài đặt cá nhân
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Hệ thống sử dụng thông báo Zalo cá nhân trực tiếp cho từng người dùng. Mỗi thành viên có thể liên kết Zalo tại trang Cài đặt tài khoản của mình.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !hasChanges}
              className="w-full sm:w-auto font-bold h-10 px-6 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang lưu...
                </>
              ) : (
                "Lưu thay đổi"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <CategorySettings groupId={group.id} />
    </div>
  );
}
