import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Camera,
  Search,
  CheckCircle2,
  Loader2,
  Barcode,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxWithAdd } from "@/components/ComboboxWithAdd";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { ProductVerificationCard } from "@/components/ProductVerificationCard";
import { lookupProductByBarcode, saveVerifiedProduct } from "@/lib/product-service";
import { useLookups } from "@/hooks/useLookups";
import type { BarcodeLookupResult, ProductMaster, BatchInventoryEntry } from "@/types/product";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() + i);

const initialForm = {
  barcode: "",
  item_name: "",
  brand: "",
  manufacturer: "",
  type: "",
  batch_code: "",
  pack_size: "",
  no_of_pack: "",
  units: "",
  mrp: "",
  expiry_month: "",
  expiry_year: "",
  product_image_url: "",
  hsn_code: "",
  gst_percentage: "",
};

interface AddMedicineFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  standalone?: boolean;
}

export function AddMedicineForm({ onSuccess, onCancel, standalone = false }: AddMedicineFormProps) {
  // Mode switcher: "medicine" (full details) vs "general" (quick entry)
  const [mode, setMode] = useState<"medicine" | "general">("general");

  const [form, setForm] = useState({ ...initialForm });
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Verification state
  const [verificationResult, setVerificationResult] = useState<BarcodeLookupResult | null>(null);
  const [activeProduct, setActiveProduct] = useState<Partial<ProductMaster> | null>(null);
  const [isExistingLocal, setIsExistingLocal] = useState(false);
  const [existingBatches, setExistingBatches] = useState<BatchInventoryEntry[]>([]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { manufacturers, types, units, addLookup } = useLookups();

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const setField = (key: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Universal Barcode Search Routine
   */
  const handleBarcodeSearch = async (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) {
      toast.error("Please enter or scan a barcode");
      return;
    }

    setBarcodeInput(clean);
    setField("barcode", clean);
    setIsSearching(true);
    setVerificationResult(null);

    try {
      const result = await lookupProductByBarcode(clean);
      setVerificationResult(result);

      if (result.found && result.product) {
        setActiveProduct(result.product);
        setIsExistingLocal(result.source === "local_db");
        setExistingBatches(result.existingBatches || []);

        // Pre-populate fields into form from product
        setForm((prev) => ({
          ...prev,
          barcode: clean,
          item_name: result.product?.product_name || prev.item_name,
          brand: result.product?.brand_name || result.product?.manufacturer || prev.brand,
          manufacturer: result.product?.manufacturer || result.product?.brand_name || prev.manufacturer,
          type: result.product?.product_type || prev.type || "Other",
          pack_size: result.product?.pack_size || prev.pack_size || "1",
          units: result.product?.unit || prev.units || (mode === "general" ? "Pieces" : ""),
          mrp: result.product?.mrp ? String(result.product.mrp) : prev.mrp,
          product_image_url: result.product?.product_image_url || prev.product_image_url,
          hsn_code: result.product?.hsn_code || prev.hsn_code,
          gst_percentage: result.product?.gst_percentage ? String(result.product.gst_percentage) : prev.gst_percentage,
        }));

        if (result.source === "local_db") {
          toast.info("Product found in local database!", { duration: 3000 });
        } else {
          toast.success("Product found from external catalog! Please verify before saving.", {
            duration: 4000,
          });
        }
      } else {
        // Not found
        setActiveProduct(null);
        setIsExistingLocal(false);
        setExistingBatches([]);
        toast.info(result.message || "Product not found. Please enter the product details manually.", {
          duration: 5000,
        });
        itemNameRef.current?.focus();
      }
    } catch (err: any) {
      toast.error(err.message || "Lookup encountered an error. You can enter details manually.");
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Resets and reopens scanner
   */
  const handleScanAgain = () => {
    setVerificationResult(null);
    setActiveProduct(null);
    setBarcodeInput("");
    setForm({ ...initialForm });
    setIsScannerOpen(true);
  };

  /**
   * Save Product and create inventory record
   */
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!form.item_name.trim()) {
      toast.error("Item Name is required");
      itemNameRef.current?.focus();
      return;
    }

    // In full medicine mode, validate batch code
    if (mode === "medicine" && !form.batch_code.trim()) {
      toast.error("Batch Code is required for medicine inventory");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // In general mode, batch code can be auto-generated or default if blank
      const finalBatchCode = form.batch_code.trim() || `GEN-${Date.now().toString().slice(-6)}`;
      const finalPackSize = form.pack_size.trim() || "1";
      const finalUnits = form.units.trim() || (mode === "general" ? "Pieces" : "1");
      const finalQty = Number(form.no_of_pack) || 1;
      const finalMrp = Number(form.mrp) || 0;
      const finalExpMonth = Number(form.expiry_month) || currentMonth;
      const finalExpYear = Number(form.expiry_year) || (currentYear + 2);

      const productPayload: Partial<ProductMaster> = {
        barcode: form.barcode.trim(),
        product_name: form.item_name.trim(),
        brand_name: form.brand.trim() || form.manufacturer.trim() || null,
        manufacturer: form.manufacturer.trim() || form.brand.trim() || "Unknown",
        product_type: form.type.trim() || "Other",
        pack_size: finalPackSize,
        unit: finalUnits,
        mrp: finalMrp,
        hsn_code: form.hsn_code.trim() || null,
        gst_percentage: form.gst_percentage ? Number(form.gst_percentage) : null,
        product_image_url: form.product_image_url || null,
        source: activeProduct?.source || "manual",
        source_provider: activeProduct?.source_provider || "RSP Database",
      };
      if (activeProduct?.id) {
        productPayload.id = activeProduct.id;
      }

      const res = await saveVerifiedProduct({
        product: productPayload,
        batch: {
          batch_code: finalBatchCode,
          pack_size: finalPackSize,
          no_of_pack: finalQty,
          units: finalUnits,
          mrp: finalMrp,
          expiry_month: finalExpMonth,
          expiry_year: finalExpYear,
        },
        userName: "Operator",
      });

      if (res.success) {
        toast.success("Medicine saved to database successfully!");
        qc.invalidateQueries({ queryKey: ["records"] });
        qc.invalidateQueries({ queryKey: ["recent-entries"] });
        qc.invalidateQueries({ queryKey: ["inventory-distinct-lookups"] });

        // Reset form
        setForm({ ...initialForm });
        setBarcodeInput("");
        setVerificationResult(null);
        setActiveProduct(null);

        if (onSuccess) {
          onSuccess();
        } else {
          barcodeInputRef.current?.focus();
        }
      }
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save medicine record");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dual Mode Switcher Tabs (Matches Screenshot 1) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("medicine")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            mode === "medicine"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Medicine (full details)
        </button>
        <button
          type="button"
          onClick={() => setMode("general")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            mode === "general"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          General item (quick)
        </button>
      </div>

      {/* Barcode Search & Scan Box */}
      <div className="surface-card p-4 space-y-2 border">
        <Label htmlFor="barcode-scanner-input" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Barcode className="h-4 w-4 text-primary" />
          Scan / Enter Barcode
        </Label>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="barcode-scanner-input"
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan with USB scanner or type barcode, then Enter"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeSearch(barcodeInput);
                }
              }}
              className="pl-9 h-11 text-sm bg-background"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 px-3.5"
            disabled={isSearching}
            onClick={() => handleBarcodeSearch(barcodeInput)}
            aria-label="Search Barcode"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            className="h-11 px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            onClick={() => setIsScannerOpen(true)}
          >
            <Camera className="h-4 w-4" />
            <span>Camera</span>
          </Button>
        </div>
      </div>

      {/* Searching State Banner */}
      {isSearching && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-xl border bg-muted/40 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Searching product information...</span>
        </div>
      )}

      {/* Product Verification Card (Section 4 & 7) */}
      {verificationResult?.found && activeProduct && (
        <ProductVerificationCard
          product={activeProduct}
          isExistingLocal={isExistingLocal}
          existingBatches={existingBatches}
          onSaveProduct={handleSave}
          onEditDetails={() => {
            // Scroll to form fields
            itemNameRef.current?.focus();
          }}
          onAddNewBatch={() => {
            setField("batch_code", "");
            setField("no_of_pack", "1");
            itemNameRef.current?.focus();
            toast.info("Enter the new batch number and quantity below");
          }}
          onScanAgain={handleScanAgain}
          onCancel={() => {
            setVerificationResult(null);
            setActiveProduct(null);
          }}
          isSaving={isSaving}
        />
      )}

      {/* Main Entry Form */}
      <form onSubmit={handleSave} className="surface-card p-4 sm:p-5 space-y-4 border">
        {mode === "general" ? (
          /* QUICK GENERAL ITEM MODE (Matches Screenshot 1) */
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="item_name" className="text-xs font-semibold">
                  Item Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item_name"
                  ref={itemNameRef}
                  required
                  placeholder="e.g. Himalaya Purifying Neem Scrub 50g"
                  value={form.item_name}
                  onChange={(e) => setField("item_name", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="brand" className="text-xs font-semibold">
                  Brand
                </Label>
                <Input
                  id="brand"
                  placeholder="e.g. Himalaya"
                  value={form.brand}
                  onChange={(e) => {
                    setField("brand", e.target.value);
                    setField("manufacturer", e.target.value);
                  }}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ComboboxWithAdd
                id="type"
                label="Type"
                value={form.type}
                onChange={(v) => setField("type", v)}
                options={types}
                onAdd={(n) => addLookup("types", n)}
                addTitle="Add New Type"
                placeholder="Select type"
              />

              <div className="space-y-1">
                <Label htmlFor="no_of_pack" className="text-xs font-semibold">
                  No. of Qty
                </Label>
                <Input
                  id="no_of_pack"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 10"
                  value={form.no_of_pack}
                  onChange={(e) => setField("no_of_pack", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="mrp" className="text-xs font-semibold">
                  MRP (₹)
                </Label>
                <Input
                  id="mrp"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 85.00"
                  value={form.mrp}
                  onChange={(e) => setField("mrp", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expiry Month</Label>
                <Select value={form.expiry_month} onValueChange={(v) => setField("expiry_month", v)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {String(i + 1).padStart(2, "0")} — {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expiry Year</Label>
                <Select value={form.expiry_year} onValueChange={(v) => setField("expiry_year", v)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Only Item Name is required — leave anything unknown blank and fill it later.
            </p>
          </div>
        ) : (
          /* MEDICINE FULL DETAILS MODE */
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="item_name_full" className="text-xs font-semibold">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item_name_full"
                ref={itemNameRef}
                required
                placeholder="e.g. Paracetamol 500mg"
                value={form.item_name}
                onChange={(e) => setField("item_name", e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ComboboxWithAdd
                id="manufacturer"
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(v) => setField("manufacturer", v)}
                options={manufacturers}
                onAdd={(n) => addLookup("manufacturers", n)}
                addTitle="Add New Manufacturer"
                placeholder="Select manufacturer"
              />

              <div className="space-y-1">
                <Label htmlFor="batch_code" className="text-xs font-semibold">
                  Batch Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="batch_code"
                  required
                  placeholder="e.g. BT-98401"
                  value={form.batch_code}
                  onChange={(e) => setField("batch_code", e.target.value)}
                  className="h-10 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ComboboxWithAdd
                id="type_full"
                label="Type"
                value={form.type}
                onChange={(v) => setField("type", v)}
                options={types}
                onAdd={(n) => addLookup("types", n)}
                addTitle="Add New Type"
                placeholder="Select type"
              />

              <div className="space-y-1">
                <Label htmlFor="pack_size" className="text-xs font-semibold">
                  Pack Size <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pack_size"
                  required
                  placeholder="e.g. 10x10"
                  value={form.pack_size}
                  onChange={(e) => setField("pack_size", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="no_of_pack_full" className="text-xs font-semibold">
                  No. of Qty <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="no_of_pack_full"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="e.g. 10"
                  value={form.no_of_pack}
                  onChange={(e) => setField("no_of_pack", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              <ComboboxWithAdd
                id="units"
                label="Units"
                value={form.units}
                onChange={(v) => setField("units", v)}
                options={units}
                onAdd={(n) => addLookup("units", n)}
                addTitle="Add New Unit"
                placeholder="Select unit"
              />

              <div className="space-y-1">
                <Label htmlFor="mrp_full" className="text-xs font-semibold">
                  MRP (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mrp_full"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="e.g. 45.00"
                  value={form.mrp}
                  onChange={(e) => setField("mrp", e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Expiry Month <span className="text-destructive">*</span>
                </Label>
                <Select value={form.expiry_month} onValueChange={(v) => setField("expiry_month", v)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {String(i + 1).padStart(2, "0")} — {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Expiry Year <span className="text-destructive">*</span>
                </Label>
                <Select value={form.expiry_year} onValueChange={(v) => setField("expiry_year", v)}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2 flex items-center gap-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="flex-1 h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            {isSaving ? "Saving to database…" : mode === "general" ? "+ Save Entry" : "+ Save to Database"}
          </Button>

          {onCancel && (
            <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(barcode) => {
          handleBarcodeSearch(barcode);
        }}
      />
    </div>
  );
}
