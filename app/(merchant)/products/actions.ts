"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { rupeesToPaise } from "@/lib/format";

export interface ProductFormState {
  error?: string;
}

const variantsSchema = z
  .array(z.object({ id: z.string().min(1), name: z.string().min(1), extraPrice: z.number().optional() }))
  .optional();

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().default(""),
  priceRupees: z.coerce.number().min(0, "Price must be positive"),
  inventory: z.coerce.number().int().min(0, "Inventory must be 0 or more"),
  category: z.string().min(1, "Category is required"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  variantsJson: z.string().optional(),
});

function parseForm(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    priceRupees: formData.get("priceRupees"),
    inventory: formData.get("inventory"),
    category: formData.get("category"),
    imageUrl: formData.get("imageUrl") ?? "",
    variantsJson: formData.get("variantsJson") ?? "",
  };

  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;
  }

  let variants: z.infer<typeof variantsSchema> = undefined;
  const trimmedVariantsJson = parsed.data.variantsJson?.trim();
  if (trimmedVariantsJson) {
    try {
      const raw = JSON.parse(trimmedVariantsJson);
      const result = variantsSchema.safeParse(raw);
      if (!result.success) {
        return { error: "Variants JSON must be an array of { id, name, extraPrice? }" } as const;
      }
      variants = result.data;
    } catch {
      return { error: "Variants field is not valid JSON" } as const;
    }
  }

  return {
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      price: rupeesToPaise(parsed.data.priceRupees),
      inventory: parsed.data.inventory,
      category: parsed.data.category,
      imageUrl: parsed.data.imageUrl || null,
      variants: variants ?? null,
    },
  } as const;
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const result = parseForm(formData);
  if ("error" in result) return { error: result.error };

  await db.insert(products).values(result.data);
  revalidatePath("/products");
  return {};
}

export async function updateProductAction(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const result = parseForm(formData);
  if ("error" in result) return { error: result.error };

  await db
    .update(products)
    .set({ ...result.data, updatedAt: new Date() })
    .where(eq(products.id, productId));
  revalidatePath("/products");
  return {};
}

export async function deleteProductAction(productId: string): Promise<{ error?: string }> {
  try {
    await db.delete(products).where(eq(products.id, productId));
  } catch {
    return {
      error: "Can't delete a product that already has orders. Consider setting inventory to 0 instead.",
    };
  }
  revalidatePath("/products");
  return {};
}
