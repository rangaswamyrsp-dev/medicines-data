import { useState, useMemo } from "react";
import {
  Download,
  Filter,
  Building2,
  Layers,
  Calendar,
  Package,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type StockRow = {
  id: string;
  user_name?: string;
  item_name: string;
  barcode?: string;
  manufacturer: string;
  type: string;
  batch_code: string;
  pack_size: string;
  no_of_pack: number;
  units: string;
  mrp: number;
  expiry_month: number;
  expiry_year: number;
  created_at: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: StockRow[];
  initialManufacturer?: string;
  initialType?: string;
  initialSearch?: string;
}

const ALL = "__all__";

export function DownloadStockModal({
  open,
  onOpenChange,
  rows,
  initialManufacturer = ALL,
  initialType = ALL,
  initialSearch = "",
}: Props) {
  const [mfr, setMfr] = useState<string>(initialManufacturer);
  const [type, setType] = useState<string>(initialType);
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [expiryStatus, setExpiryStatus] = useState<"all" | "active" | "expiring_soon" | "expired">("all");
  const [unitFilter, setUnitFilter] = useState<string>(ALL);
  const [search, setSearch] = useState<string>(initialSearch);

  // Sync initial values when modal opens
  const resetFilters = () => {
    setMfr(ALL);
    setType(ALL);
    setStockStatus("all");
    setExpiryStatus("all");
    setUnitFilter(ALL);
    setSearch("");
  };

  // Distinct values with counts
  const mfrList = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.manufacturer?.trim() || "Unspecified";
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const typeList = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.type?.trim() || "Other";
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const unitList = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.units?.trim();
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Expiry check logic
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const isRowExpired = (m: number, y: number) => {
    return y < currentYear || (y === currentYear && m < currentMonth);
  };

  const isRowExpiringSoon = (m: number, y: number) => {
    if (isRowExpired(m, y)) return false;
    const monthsLeft = (y - currentYear) * 12 + (m - currentMonth);
    return monthsLeft <= 3;
  };

  // Filtered dataset
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Company filter
      if (mfr !== ALL && r.manufacturer !== mfr) return false;

      // Type filter
      if (type !== ALL && r.type !== type) return false;

      // Units filter
      if (unitFilter !== ALL && r.units !== unitFilter) return false;

      // Stock status filter
      if (stockStatus === "in_stock" && r.no_of_pack <= 0) return false;
      if (stockStatus === "low_stock" && (r.no_of_pack <= 0 || r.no_of_pack > 5)) return false;
      if (stockStatus === "out_of_stock" && r.no_of_pack > 0) return false;

      // Expiry status filter
      const expired = isRowExpired(r.expiry_month, r.expiry_year);
      const expiringSoon = isRowExpiringSoon(r.expiry_month, r.expiry_year);

      if (expiryStatus === "active" && expired) return false;
      if (expiryStatus === "expiring_soon" && !expiringSoon) return false;
      if (expiryStatus === "expired" && !expired) return false;

      // Search keyword filter
      if (q) {
        const matches = [
          r.item_name,
          r.barcode,
          r.manufacturer,
          r.type,
          r.batch_code,
          r.units,
          r.pack_size,
        ].some((val) => val?.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [rows, mfr, type, unitFilter, stockStatus, expiryStatus, search]);

  // Aggregate stats for filtered data
  const totalQty = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(r.no_of_pack) || 0), 0),
    [filteredRows]
  );

  const totalValue = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(r.no_of_pack) || 0) * (Number(r.mrp) || 0), 0),
    [filteredRows]
  );

  // Active filters count
  const activeFiltersCount = [
    mfr !== ALL,
    type !== ALL,
    unitFilter !== ALL,
    stockStatus !== "all",
    expiryStatus !== "all",
    search.trim() !== "",
  ].filter(Boolean).length;

  // Handle Download CSV
  const handleDownload = () => {
    if (filteredRows.length === 0) {
      toast.error("No medicine records match your selected filters.");
      return;
    }

    const headers = [
      "Item Name",
      "Barcode",
      "Company / Manufacturer",
      "Type",
      "Batch Code",
      "Pack Size",
      "Quantity",
      "Units",
      "MRP (INR)",
      "Total Value (INR)",
      "Expiry Month",
      "Expiry Year",
      "Expiry Date",
      "Expiry Status",
      "Stock Status",
      "Created At",
    ];

    const lines = filteredRows.map((r) => {
      const expired = isRowExpired(r.expiry_month, r.expiry_year);
      const expiringSoon = isRowExpiringSoon(r.expiry_month, r.expiry_year);
      const expStatus = expired ? "Expired" : expiringSoon ? "Expiring Soon" : "Active";
      const stkStatus = r.no_of_pack <= 0 ? "Out of Stock" : r.no_of_pack <= 5 ? "Low Stock" : "In Stock";
      const totalItemValue = (Number(r.no_of_pack) || 0) * (Number(r.mrp) || 0);

      return [
        r.item_name,
        r.barcode || "",
        r.manufacturer,
        r.type,
        r.batch_code,
        r.pack_size,
        r.no_of_pack,
        r.units,
        r.mrp,
        totalItemValue.toFixed(2),
        r.expiry_month,
        r.expiry_year,
        `${String(r.expiry_month).padStart(2, "0")}/${r.expiry_year}`,
        expStatus,
        stkStatus,
        r.created_at ? new Date(r.created_at).toLocaleString() : "",
      ]
        .map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Dynamic descriptive file name
    const parts: string[] = ["medicine-stock"];
    if (mfr !== ALL) parts.push(mfr.replace(/[^a-zA-Z0-9]/g, "-"));
    if (type !== ALL) parts.push(type.replace(/[^a-zA-Z0-9]/g, "-"));
    if (expiryStatus !== "all") parts.push(expiryStatus);
    if (stockStatus !== "all") parts.push(stockStatus);
    parts.push(new Date().toISOString().slice(0, 10));

    const filename = `${parts.join("_")}.csv`;
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredRows.length} medicine records to ${filename}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Download Stock (CSV / Excel)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Filter by Company, Type, Expiry, or Stock before downloading.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Filter Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Quick:
          </span>
          <Button
            type="button"
            variant={activeFiltersCount === 0 ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={resetFilters}
          >
            All Stock ({rows.length})
          </Button>
          <Button
            type="button"
            variant={stockStatus === "in_stock" ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => {
              setStockStatus(stockStatus === "in_stock" ? "all" : "in_stock");
            }}
          >
            🟢 In Stock Only
          </Button>
          <Button
            type="button"
            variant={expiryStatus === "expiring_soon" ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg text-amber-600 dark:text-amber-400"
            onClick={() => {
              setExpiryStatus(expiryStatus === "expiring_soon" ? "all" : "expiring_soon");
            }}
          >
            ⚠️ Expiring Soon
          </Button>
          <Button
            type="button"
            variant={expiryStatus === "expired" ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-lg text-destructive"
            onClick={() => {
              setExpiryStatus(expiryStatus === "expired" ? "all" : "expired");
            }}
          >
            🔴 Expired
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground ml-auto"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset All
            </Button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {/* Company / Manufacturer Wise Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Company / Manufacturer Wise
            </Label>
            <Select value={mfr} onValueChange={setMfr}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value={ALL} className="font-semibold">
                  All Companies ({rows.length})
                </SelectItem>
                {mfrList.map((m) => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} ({m.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Wise Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Medicine Type Wise
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value={ALL} className="font-semibold">
                  All Types ({rows.length})
                </SelectItem>
                {typeList.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Availability Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" />
              Stock Availability
            </Label>
            <Select
              value={stockStatus}
              onValueChange={(v: any) => setStockStatus(v)}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Statuses</SelectItem>
                <SelectItem value="in_stock">In Stock Only (Qty &gt; 0)</SelectItem>
                <SelectItem value="low_stock">Low Stock Only (Qty 1 to 5)</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock (Qty = 0)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expiry Status Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Expiry Status
            </Label>
            <Select
              value={expiryStatus}
              onValueChange={(v: any) => setExpiryStatus(v)}
            >
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Expiry Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expiry Dates</SelectItem>
                <SelectItem value="active">Active / Safe Medicines</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon (Within 3 Mo)</SelectItem>
                <SelectItem value="expired">Expired Medicines</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Units Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Units / Dosage</Label>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue placeholder="All Units" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value={ALL}>All Units</SelectItem>
                {unitList.map((u) => (
                  <SelectItem key={u.name} value={u.name}>
                    {u.name} ({u.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Term Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Search Keyword (Optional)</Label>
            <Input
              className="h-10 text-xs"
              placeholder="Filter by name, batch, barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Live Filter Summary Card */}
        <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Matched Records:</span>
              <Badge
                variant={filteredRows.length > 0 ? "default" : "destructive"}
                className="text-xs font-bold px-2 py-0.5"
              >
                {filteredRows.length} {filteredRows.length === 1 ? "Medicine" : "Medicines"}
              </Badge>
            </div>
            {filteredRows.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                <span>Total Qty: <strong className="text-foreground">{totalQty}</strong></span>
                <span>Total Value: <strong className="text-foreground">₹{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
            )}
          </div>

          {/* Quick preview of top 3 matching items */}
          {filteredRows.length > 0 ? (
            <div className="space-y-1.5 border-t pt-2">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Preview of download data:
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs divide-y divide-border/40">
                {filteredRows.slice(0, 4).map((r) => (
                  <div key={r.id} className="pt-1 first:pt-0 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="font-semibold text-foreground">{r.item_name}</span>{" "}
                      <span className="text-muted-foreground text-[11px]">
                        ({r.manufacturer} · {r.type})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground shrink-0 font-mono">
                      Qty: {r.no_of_pack} {r.units} · Batch {r.batch_code}
                    </div>
                  </div>
                ))}
                {filteredRows.length > 4 && (
                  <p className="text-[11px] text-muted-foreground pt-1 italic">
                    + {filteredRows.length - 4} more medicines will be included in the file
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-destructive py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No medicines match these filter criteria. Broaden your selection above.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={filteredRows.length === 0}
            onClick={handleDownload}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <Download className="h-4 w-4" />
            Download {filteredRows.length} Medicines (CSV)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
