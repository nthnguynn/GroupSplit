"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function CreateGroupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error || "Tạo nhóm thất bại");
    } else {
      toast.success("Tạo nhóm thành công!");
      router.push(`/groups/${data.id}`);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="group-name">Tên nhóm *</Label>
            <Input
              id="group-name"
              name="name"
              placeholder="VD: Chuyến du lịch Đà Lạt 2025"
              required
              maxLength={100}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="group-description"
              name="description"
              placeholder="Thêm mô tả ngắn về nhóm..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Huỷ
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Tạo nhóm"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
