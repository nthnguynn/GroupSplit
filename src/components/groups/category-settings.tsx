"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  createdAt: string;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

interface CategorySettingsProps {
  groupId: string;
}

const SUGGESTED_EMOJIS = ["🍽️", "🚗", "🛒", "🎉", "🏠", "📦", "☕", "🎮", "✈️", "💊", "👕", "🍿", "💸", "🏋️", "💡", "📚"];

export function CategorySettings({ groupId }: CategorySettingsProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("📦");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Category states
  const [addingParentId, setAddingParentId] = useState<string | null | undefined>(undefined); // undefined means not adding, null means adding root
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");

  useEffect(() => {
    fetchCategories();
  }, [groupId]);

  async function fetchCategories() {
    try {
      const res = await fetch(`/api/groups/${groupId}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        // Automatically expand all nodes initially
        setExpandedNodes(new Set(data.map((c: Category) => c.id)));
      } else {
        toast.error("Không thể tải danh sách danh mục");
      }
    } catch (err) {
      console.error(err);
      toast.error("Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedNodes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedNodes(next);
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setAddingParentId(undefined); // close any add form
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditIcon("📦");
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      toast.error("Tên danh mục không được để trống");
      return;
    }
    setActionLoading(id);

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), icon: editIcon }),
      });

      if (res.ok) {
        toast.success("Đã cập nhật danh mục");
        setEditingId(null);
        await fetchCategories();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Cập nhật thất bại");
      }
    } catch (err) {
      toast.error("Lỗi kết nối");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa danh mục này? Tất cả danh mục con và hóa đơn thuộc về chúng sẽ được chuyển sang danh mục 'Khác'.")) return;
    setActionLoading(id);

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Đã xóa danh mục và chuyển các hóa đơn liên quan sang 'Khác'");
        await fetchCategories();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Xóa thất bại");
      }
    } catch (err) {
      toast.error("Lỗi kết nối");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddCategory(parentId: string | null) {
    if (!newName.trim()) {
      toast.error("Tên danh mục không được để trống");
      return;
    }
    setActionLoading("add");

    try {
      const res = await fetch(`/api/groups/${groupId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          icon: newIcon,
          parentId,
        }),
      });

      if (res.ok) {
        toast.success("Đã thêm danh mục mới");
        setNewName("");
        setNewIcon("📦");
        setAddingParentId(undefined);
        await fetchCategories();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Thêm danh mục thất bại");
      }
    } catch (err) {
      toast.error("Lỗi kết nối");
    } finally {
      setActionLoading(null);
    }
  }

  // Build tree hierarchy
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Recursive Category Item Component
  const renderCategoryNode = (node: CategoryNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isEditing = editingId === node.id;
    const hasChildren = node.children.length > 0;
    const isDefaultKhac = node.name === "Khác" && node.parentId === null;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className="flex items-center gap-2 p-2 rounded-xl border border-border/40 hover:bg-muted/40 transition-colors"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          {/* Collapse/Expand Arrow */}
          <button
            type="button"
            onClick={() => toggleExpand(node.id)}
            className={`w-5 h-5 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-all ${
              !hasChildren && "opacity-0 pointer-events-none"
            }`}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Icon */}
          <span className="text-lg shrink-0 w-6 text-center select-none">{node.icon}</span>

          {/* Node detail / Edit mode */}
          {isEditing ? (
            <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-xs font-semibold flex-1"
                placeholder="Tên danh mục"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  className="h-8 w-12 text-center text-xs font-mono"
                  maxLength={2}
                />
                <Button
                  size="sm"
                  onClick={() => handleSaveEdit(node.id)}
                  disabled={actionLoading === node.id}
                  className="h-8 px-2 text-xs font-semibold gap-1 bg-primary text-primary-foreground"
                >
                  {actionLoading === node.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Lưu
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 px-2 text-xs">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between min-w-0">
              <span className="text-sm font-semibold truncate text-foreground">{node.name}</span>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {/* Add Subcategory */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setAddingParentId(node.id);
                    setEditingId(null);
                  }}
                  className="h-7 w-7 text-primary hover:bg-primary/10 rounded-lg"
                  title="Thêm danh mục con"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>

                {/* Edit */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => startEdit(node)}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>

                {/* Delete */}
                {!isDefaultKhac && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(node.id)}
                    disabled={actionLoading === node.id}
                    className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg"
                    title="Xóa danh mục"
                  >
                    {actionLoading === node.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form adding subcategory under this node */}
        {addingParentId === node.id && (
          <div
            className="p-3 border rounded-xl bg-muted/20 space-y-2.5"
            style={{ marginLeft: `${(depth + 1) * 20}px` }}
          >
            <Label className="text-xs font-bold text-muted-foreground">Thêm danh mục con vào "{node.name}"</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên danh mục con..."
                className="h-9 text-xs flex-1"
                required
              />
              <Input
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                placeholder="Emoji"
                className="h-9 w-14 text-center text-xs font-mono"
                maxLength={2}
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {SUGGESTED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewIcon(emoji)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-sm hover:bg-accent border transition-all ${
                    newIcon === emoji ? "border-primary bg-primary/10" : "border-transparent"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAddingParentId(undefined)} className="h-8 px-2.5 text-xs">
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => handleAddCategory(node.id)}
                disabled={actionLoading === "add"}
                className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground"
              >
                {actionLoading === "add" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Thêm danh mục
              </Button>
            </div>
          </div>
        )}

        {/* Render children nodes */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold">Danh mục Chi tiêu Nhóm</CardTitle>
          <p className="text-xs text-muted-foreground">Thiết lập các danh mục chi tiêu riêng cho nhóm này.</p>
        </div>
        {addingParentId !== null && (
          <Button
            size="sm"
            onClick={() => {
              setAddingParentId(null);
              setEditingId(null);
            }}
            className="h-8 text-xs font-semibold gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm danh mục gốc
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form adding root category */}
        {addingParentId === null && (
          <div className="p-3 border rounded-xl bg-muted/20 space-y-2.5">
            <Label className="text-xs font-bold text-muted-foreground">Thêm danh mục gốc mới</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên danh mục gốc..."
                className="h-9 text-xs flex-1"
                required
              />
              <Input
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                placeholder="Emoji"
                className="h-9 w-14 text-center text-xs font-mono"
                maxLength={2}
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {SUGGESTED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewIcon(emoji)}
                  className={`w-6 h-6 rounded flex items-center justify-center text-sm hover:bg-accent border transition-all ${
                    newIcon === emoji ? "border-primary bg-primary/10" : "border-transparent"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAddingParentId(undefined)} className="h-8 px-2.5 text-xs">
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => handleAddCategory(null)}
                disabled={actionLoading === "add"}
                className="h-8 px-3 text-xs font-semibold bg-primary text-primary-foreground"
              >
                {actionLoading === "add" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Thêm danh mục
              </Button>
            </div>
          </div>
        )}

        {/* Tree Render */}
        <div className="space-y-2 group">
          {roots.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">Chưa có danh mục nào được thiết lập.</p>
          ) : (
            roots.map((root) => renderCategoryNode(root))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
