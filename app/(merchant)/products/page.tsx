import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPaise } from "@/lib/format";
import { ProductFormDialog } from "@/components/merchant/ProductFormDialog";
import { DeleteProductButton } from "@/components/merchant/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-muted-foreground">Manage your catalog.</p>
        </div>
        <ProductFormDialog triggerLabel="Add product" />
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No products yet. Add your first product to get started.
                </TableCell>
              </TableRow>
            ) : (
              allProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                  </TableCell>
                  <TableCell>{formatPaise(product.price)}</TableCell>
                  <TableCell>
                    {product.inventory === 0 ? (
                      <span className="text-destructive">Out of stock</span>
                    ) : (
                      product.inventory
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ProductFormDialog
                        product={product}
                        triggerLabel="Edit"
                        triggerVariant="ghost"
                        triggerSize="sm"
                      />
                      <DeleteProductButton productId={product.id} name={product.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
