"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProductAction } from "@/app/(merchant)/products/actions";

export function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        startTransition(async () => {
          const result = await deleteProductAction(productId);
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success(`${name} deleted`);
          }
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
