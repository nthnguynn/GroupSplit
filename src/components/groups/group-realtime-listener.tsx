"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface GroupRealtimeListenerProps {
  groupId: string;
}

export function GroupRealtimeListener({ groupId }: GroupRealtimeListenerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!groupId) return;

    // Thiết lập kết nối Server-Sent Events (SSE) để nhận cập nhật realtime
    const eventSource = new EventSource(`/api/groups/${groupId}/realtime`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "REFRESH") {
          console.log("[Realtime] Nhận được tín hiệu cập nhật nhóm. Tự động tải lại trang...");
          router.refresh();
        }
      } catch (err) {
        // Bỏ qua các tin nhắn kết nối ban đầu
      }
    };

    eventSource.onerror = () => {
      // EventSource tự động kết nối lại khi readyState === CONNECTING (0)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("[Realtime] Kết nối SSE đã đóng.");
      }
    };

    // Đóng kết nối khi component bị unmount
    return () => {
      eventSource.close();
    };
  }, [groupId, router]);

  // Component này chỉ chạy ngầm dưới client nên không cần render gì
  return null;
}
