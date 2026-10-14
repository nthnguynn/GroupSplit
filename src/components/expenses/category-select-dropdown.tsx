"use client";

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronDown, Check, Tag, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
}

interface CategorySelectDropdownProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (cat: Category) => void;
  loading?: boolean;
  className?: string;
}

export function CategorySelectDropdown({
  categories,
  selectedCategoryId,
  onSelectCategory,
  loading = false,
  className,
}: CategorySelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Tìm danh mục đang chọn & danh mục cha (nếu có)
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const parentOfSelected = useMemo(() => {
    if (!selectedCategory || !selectedCategory.parentId) return null;
    return categories.find((c) => c.id === selectedCategory.parentId) || null;
  }, [categories, selectedCategory]);

  // Tổ chức cấu trúc Cây Danh Mục (Parent -> Children)
  const categoryTree = useMemo(() => {
    const parentCats = categories.filter((c) => c.parentId === null);
    const childrenMap = new Map<string, Category[]>();

    categories.forEach((c) => {
      if (c.parentId) {
        const list = childrenMap.get(c.parentId) || [];
        list.push(c);
        childrenMap.set(c.parentId, list);
      }
    });

    return parentCats.map((parent) => ({
      parent,
      children: childrenMap.get(parent.id) || [],
    }));
  }, [categories]);

  // Lọc theo từ khóa tìm kiếm
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return categoryTree;

    const query = searchQuery.toLowerCase().trim();

    return categoryTree
      .map(({ parent, children }) => {
        const parentMatch = parent.name.toLowerCase().includes(query);
        const matchedChildren = children.filter((c) =>
          c.name.toLowerCase().includes(query)
        );

        if (parentMatch) {
          return { parent, children };
        }

        if (matchedChildren.length > 0) {
          return { parent, children: matchedChildren };
        }

        return null;
      })
      .filter((item): item is { parent: Category; children: Category[] } => item !== null);
  }, [categoryTree, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-all hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer select-none",
          className
        )}
      >
        {selectedCategory ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="text-xl shrink-0 leading-none">
              {selectedCategory.icon || "📦"}
            </span>
            <div className="flex items-center gap-2 truncate text-left">
              <span className="font-bold text-foreground text-sm truncate">
                {selectedCategory.name}
              </span>
              {parentOfSelected && (
                <Badge
                  variant="outline"
                  className="h-4 text-[10px] px-1.5 font-normal bg-muted text-muted-foreground border border-border/50 shrink-0"
                >
                  {parentOfSelected.name}
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-normal">
            <FolderTree className="h-4 w-4 opacity-50" />
            <span>Chọn danh mục chi tiêu...</span>
          </div>
        )}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--anchor-width)] min-w-[280px] p-0 shadow-lg border rounded-xl"
        align="start"
      >
        {/* Search Header - Tương tự BankSelect */}
        <div className="p-2 border-b bg-muted/30 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
          <Input
            placeholder="Tìm theo tên danh mục (VD: Cà phê, Xăng xe)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-0 bg-transparent focus-visible:ring-0 text-xs shadow-none"
          />
        </div>

        {/* Categories List */}
        <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-2 scrollbar-thin text-xs">
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              Đang tải danh mục...
            </p>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground space-y-1">
              <Tag className="h-5 w-5 mx-auto opacity-40" />
              <p className="text-xs">Không tìm thấy danh mục "{searchQuery}"</p>
            </div>
          ) : (
            filteredTree.map(({ parent, children }) => {
              const isParentSelected = selectedCategoryId === parent.id;

              return (
                <div key={parent.id} className="space-y-1">
                  {/* Danh mục Gốc (Section Header) */}
                  <div
                    onClick={() => {
                      onSelectCategory(parent);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg text-xs font-bold cursor-pointer transition-colors select-none",
                      isParentSelected
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/40 hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="text-base shrink-0">{parent.icon}</span>
                      <span className="truncate">{parent.name}</span>
                    </div>
                    {isParentSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>

                  {/* Các Danh mục Chi tiết (Subcategories) */}
                  {children.length > 0 && (
                    <div className="pl-3.5 space-y-0.5 border-l-2 border-border/60 ml-3 my-1">
                      {children.map((child) => {
                        const isChildSelected = selectedCategoryId === child.id;
                        return (
                          <div
                            key={child.id}
                            onClick={() => {
                              onSelectCategory(child);
                              setOpen(false);
                            }}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors select-none",
                              isChildSelected
                                ? "bg-primary/15 font-bold text-primary"
                                : "hover:bg-accent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <span className="text-sm shrink-0">{child.icon}</span>
                              <span className="truncate">{child.name}</span>
                            </div>
                            {isChildSelected && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
