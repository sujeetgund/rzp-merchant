"use client";

import { useTransition } from "react";
import { gooeyToast } from "@/components/ui/goey-toaster";
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
            gooeyToast.error(result.error);
          } else {
            gooeyToast.success(`${name} deleted`);
          }
        });
      }}
    >
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
