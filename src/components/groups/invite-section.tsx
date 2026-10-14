"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Copy, Check, Link2 } from "lucide-react";

interface InviteSectionProps {
  inviteUrl: string;
  inviteCode: string;
}

export function InviteSection({ inviteUrl, inviteCode }: InviteSectionProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Đã copy link mời!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Link mời tham gia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Chia sẻ link này để mời người khác tham gia nhóm
        </p>
        <div className="flex gap-2">
          <Input
            value={inviteUrl}
            readOnly
            className="text-xs font-mono bg-muted"
          />
          <Button
            onClick={copyLink}
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Mã mời:{" "}
          <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
            {inviteCode}
          </code>
        </p>
      </CardContent>
    </Card>
  );
}
