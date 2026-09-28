import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Pencil,
  Save,
  RotateCcw,
  X,
  Package,
  Layers,
  Image as ImageIcon,
  Building2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BatchInventoryEntry, ProductMaster } from "@/types/product";

interface ProductVerificationCardProps {
  product: Partial<ProductMaster>;
  isExistingLocal: boolean;
  existingBatches?: BatchInventoryEntry[];
  onSaveProduct: () => void;
  onEditDetails: () => void;
  onScanAgain: () => void;
  onCancel: () => void;
  onAddNewBatch?: () => void;
  isSaving?: boolean;
}

export function ProductVerificationCard({
  product,
  isExistingLocal,
  existingBatches = [],
  onSaveProduct,
  onEditDetails,
  onScanAgain,
  onCancel,
  onAddNewBatch,
  isSaving = false,
}: ProductVerificationCardProps) {
  const [useImage, setUseImage] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [showBatches, setShowBatches] = useState(false);

  const hasImage = Boolean(product.product_image_url && !imgError);

  return (
    <div className="rounded-xl border border-primary/25 bg-card p-4 sm:p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-3">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          {isExistingLocal ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <AlertCircle className="h-5 w-5" />
              <span>Product already exists in local database</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>PRODUCT FOUND ✓</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isExistingLocal
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
            }
          >
            Source: {product.source_provider || (isExistingLocal ? "RSP Database" : "External Product API")}
          </Badge>
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border text-foreground">
            {product.barcode}
          </span>
        </div>
      </div>

      {/* Product Information Body */}
      <div className="grid gap-4 sm:grid-cols-4 items-start">
        {/* Product Image or Placeholder */}
        <div className="sm:col-span-1 flex flex-col items-center justify-center p-2 rounded-lg border bg-muted/30">
          {hasImage && useImage ? (
            <div className="relative group w-full flex flex-col items-center">
              <img
                src={product.product_image_url!}
                alt={product.product_name}
                className="max-h-28 w-auto object-contain rounded"
                onError={() => setImgError(true)}
              />
              <button
                type="button"
                onClick={() => setUseImage(false)}
                className="mt-1 text-[10px] text-muted-foreground hover:underline"
              >
                Hide image
              </button>
            </div>
          ) : (
            <div className="h-28 w-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <Package className="h-10 w-10 stroke-[1.5]" />
              <span className="text-[10px]">No image available</span>
              {product.product_image_url && !useImage && (
                <button
                  type="button"
                  onClick={() => setUseImage(true)}
                  className="text-[10px] text-primary hover:underline font-medium"
                >
                  [ Use Image ]
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product Attributes Grid */}
        <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="col-span-2 sm:col-span-3">
            <span className="text-muted-foreground block text-[11px]">Product Name:</span>
            <span className="font-bold text-sm text-foreground leading-tight">
              {product.product_name || "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Brand:</span>
            <span className="font-semibold text-foreground">
              {product.brand_name || product.manufacturer || "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Manufacturer:</span>
            <span className="font-semibold text-foreground">
              {product.manufacturer || product.brand_name || "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Pack Size:</span>
            <span className="font-semibold text-foreground">
              {product.pack_size ? `${product.pack_size} ${product.unit || ""}`.trim() : "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">MRP:</span>
            <span className="font-bold text-sm text-primary">
              {product.mrp ? `₹${Number(product.mrp).toFixed(2)}` : "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">HSN Code:</span>
            <span className="font-mono text-foreground">
              {product.hsn_code || "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">GST %:</span>
            <span className="font-medium text-foreground">
              {product.gst_percentage !== undefined && product.gst_percentage !== null
                ? `${product.gst_percentage}%`
                : "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Type / Category:</span>
            <span className="font-medium text-foreground">
              {product.product_type || product.category || "Not available"}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Expiry:</span>
            <span className="text-muted-foreground">Not available (set in batch)</span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px]">Batch:</span>
            <span className="text-muted-foreground">Not available (set in batch)</span>
          </div>
        </div>
      </div>

      {/* Existing Batches Drawer / List (Section 6 & 7) */}
      {isExistingLocal && existingBatches.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              Existing Batches in Stock ({existingBatches.length})
            </span>
            <button
              type="button"
              onClick={() => setShowBatches(!showBatches)}
              className="text-xs text-primary hover:underline font-medium"
            >
              {showBatches ? "Hide batches" : "View batches"}
            </button>
          </div>

          {showBatches && (
            <div className="space-y-1.5 pt-1">
              {existingBatches.map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="flex items-center justify-between text-xs p-2 rounded bg-card border"
                >
                  <div>
                    <span className="font-mono font-semibold text-foreground">Batch: {b.batch_code}</span>
                    <span className="text-muted-foreground ml-2">
                      Qty: {b.no_of_pack} {b.units}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">
                      Exp: {String(b.expiry_month).padStart(2, "0")}/{b.expiry_year}
                    </span>
                    <span className="font-semibold text-primary ml-2">₹{b.mrp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
        <div className="flex flex-wrap items-center gap-2">
          {isExistingLocal ? (
            <>
              {onAddNewBatch && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={onAddNewBatch}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Package className="h-4 w-4" />
                  Add New Batch
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditDetails}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Product
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isSaving}
                onClick={onSaveProduct}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving…" : "Save Product"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditDetails}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Details
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onScanAgain}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Scan Again
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
