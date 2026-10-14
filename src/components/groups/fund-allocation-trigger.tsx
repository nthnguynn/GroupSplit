"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { FundAllocationForm } from "./fund-allocation-form";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
}

interface FundAllocationTriggerProps {
  groupId: string;
  members: Member[];
  isFundManager: boolean;
}

export function FundAllocationTrigger({
  groupId,
  members,
  isFundManager,
}: FundAllocationTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isFundManager) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="gap-2 shrink-0 h-11 md:h-12 px-5 md:px-6 text-sm md:text-base font-bold shadow-md rounded-xl bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 cursor-pointer"
      >
        <Coins className="h-5 w-5 text-white" />
        <span>Cấp tiền quỹ</span>
      </Button>

      <FundAllocationForm
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        groupId={groupId}
        members={members}
      />
    </>
  );
}
