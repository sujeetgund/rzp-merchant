"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/db/schema";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/app/(merchant)/products/actions";

const initialState: ProductFormState = {};

export function ProductFormDialog({
  product,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  product?: Product;
  triggerLabel: React.ReactNode;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  triggerSize?: "default" | "sm" | "lg" | "icon";
}) {
  const [open, setOpen] = useState(false);
  // Track whether a submit actually happened, so opening the dialog fresh
  // doesn't immediately close it on the initial (empty) state.
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const action = product ? updateProductAction.bind(null, product.id) : createProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Close the dialog once a submitted action finishes without an error.
  // Comparing against the previous `pending` value during render (rather
  // than in an effect) is React's documented pattern for reacting to a
  // prop/state change without an extra render round-trip.
  const [prevPending, setPrevPending] = useState(pending);
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (open && !pending && wasSubmitted && !state.error) {
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setWasSubmitted(false);
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update the details for this product." : "Add a new product to your catalog."}
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => setWasSubmitted(true)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={product?.description} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceRupees">Price (₹)</Label>
              <Input
                id="priceRupees"
                name="priceRupees"
                type="number"
                min="0"
                step="0.01"
                defaultValue={product ? product.price / 100 : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory">Inventory</Label>
              <Input
                id="inventory"
                name="inventory"
                type="number"
                min="0"
                defaultValue={product?.inventory}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue={product?.category} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" name="imageUrl" type="url" defaultValue={product?.imageUrl ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="variantsJson">Variants (JSON, optional)</Label>
            <Textarea
              id="variantsJson"
              name="variantsJson"
              rows={2}
              placeholder='[{"id":"m","name":"M"},{"id":"l","name":"L"}]'
              defaultValue={product?.variants ? JSON.stringify(product.variants) : ""}
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
