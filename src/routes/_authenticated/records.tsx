import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  Download,
  Filter as FilterIcon,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "Medicine Stock Records | Medicine Inventory" },
      { name: "description", content: "View, search, edit quantity, and update expiry dates in Supabase PostgreSQL." },
      { property: "og:title", content: "Medicine Stock Records | Medicine Inventory" },
    ],
  }),
  component: RecordsPage,
});

type Row = {
  id: string;
  user_name: string;
  item_name: string;
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

const ALL = "__all__";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 1 + i);

function getExpiryStatus(month: number, year: number): { label: string; color: string; isExpired: boolean } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { label: "Expired", color: "bg-destructive/15 text-destructive border-destructive/30", isExpired: true };
  }

  const monthsLeft = (year - currentYear) * 12 + (month - currentMonth);
  if (monthsLeft <= 3) {
    return {
      label: `Exp in ${monthsLeft === 0 ? "this mo" : `${monthsLeft}m`}`,
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      isExpired: false,
    };
  }

  return { label: "Active", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", isExpired: false };
}

function RecordsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [fMfr, setFMfr] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [showFilters, setShowFilters] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  // Fetch records directly from Supabase PostgreSQL
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["records"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (error) {
          console.error("Records query error:", error);
          toast.error(error.message);
          return [];
        }
        return (data ?? []) as Row[];
      } catch (err) {
        console.error("Fetch records error:", err);
        return [];
      }
    },
  });

  // Direct Quantity Stepper (+ / -) mutation
  const adjustQty = useMutation({
    mutationFn: async ({ id, newQty }: { id: string; newQty: number }) => {
      const { error } = await supabase
        .from("inventory")
        .update({ no_of_pack: newQty, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id, newQty };
    },
    onMutate: async ({ id, newQty }) => {
      await qc.cancelQueries({ queryKey: ["records"] });
      const previous = qc.getQueryData<Row[]>(["records"]);
      if (previous) {
        qc.setQueryData<Row[]>(["records"], previous.map((r) => (r.id === id ? { ...r, no_of_pack: newQty } : r)));
      }
      return { previous };
    },
    onError: (err, _, context) => {
      if (context?.previous) qc.setQueryData(["records"], context.previous);
      toast.error(err instanceof Error ? err.message : "Could not update quantity");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["records"] });
    },
  });

  // Edit record mutation
  const update = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("inventory")
        .update({
          item_name: row.item_name.trim(),
          manufacturer: row.manufacturer.trim(),
          type: row.type.trim(),
          batch_code: row.batch_code.trim(),
          pack_size: row.pack_size.trim(),
          no_of_pack: Number(row.no_of_pack),
          units: row.units.trim(),
          mrp: Number(row.mrp),
          expiry_month: Number(row.expiry_month),
          expiry_year: Number(row.expiry_year),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medicine details updated");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["inventory-distinct-lookups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete record mutation
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record deleted");
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["inventory-distinct-lookups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uniq = (vals: (string | number)[]) => Array.from(new Set(vals.map(String).filter(Boolean))).sort();

  // Search on Item Name, Manufacturer, Batch Code, Type, Units
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fMfr !== ALL && r.manufacturer !== fMfr) return false;
      if (fType !== ALL && r.type !== fType) return false;
      if (
        q &&
        ![r.item_name, r.manufacturer, r.type, r.batch_code, r.units].some((v) =>
          v?.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [rows, search, fMfr, fType]);

  const exportCsv = () => {
    const head = [
      "Item Name", "Manufacturer", "Type", "Batch No",
      "Pack Size", "Qty", "Units", "MRP", "Expiry Date", "Created At",
    ];
    const lines = filtered.map((r) =>
      [
        r.item_name,
        r.manufacturer,
        r.type,
        r.batch_code,
        r.pack_size,
        r.no_of_pack,
        r.units,
        r.mrp,
        `${String(r.expiry_month).padStart(2, "0")}/${r.expiry_year}`,
        new Date(r.created_at).toLocaleString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `medicine-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold md:text-2xl text-foreground">Stock Records</h1>
          <p className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "medicine" : "medicines"} in database
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 shadow-2xs">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span> CSV
        </Button>
      </div>

      {/* Prominent Search Bar */}
      <div className="sticky top-14 z-20 space-y-2 bg-background/95 pt-1 pb-2 backdrop-blur">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="h-12 pl-10 pr-24 rounded-xl text-base shadow-xs border-input bg-card focus-visible:ring-2 focus-visible:ring-primary"
            placeholder="Search medicine, batch no, company, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="absolute right-2 flex items-center gap-1">
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              type="button"
              variant={showFilters || fMfr !== ALL || fType !== ALL ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 text-xs gap-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Filter</span>
              {(fMfr !== ALL || fType !== ALL) && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </div>

        {/* Filter Drawer */}
        {showFilters && (
          <div className="surface-card p-3 grid grid-cols-2 gap-2 text-xs animate-in fade-in slide-in-from-top-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Company</Label>
              <Select value={fMfr} onValueChange={setFMfr}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Companies</SelectItem>
                  {uniq(rows.map((r) => r.manufacturer)).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Types</SelectItem>
                  {uniq(rows.map((r) => r.type)).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(fMfr !== ALL || fType !== ALL) && (
              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFMfr(ALL);
                    setFType(ALL);
                  }}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Records Table Format */}
      {isLoading ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Loading records from database…
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-card p-8 text-center space-y-2">
          <p className="text-base font-semibold text-foreground">No medicines found</p>
          <p className="text-xs text-muted-foreground">
            {search ? "Try searching with a different name or batch number." : "No records yet. Tap 'Add Stock' to add your first medicine."}
          </p>
          {search && (
            <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-2">
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                  <th className="py-3 px-4 min-w-[160px]">Item Name</th>
                  <th className="py-3 px-4 min-w-[120px]">Manufacturer</th>
                  <th className="py-3 px-3 min-w-[90px]">Type</th>
                  <th className="py-3 px-3 min-w-[110px]">Batch No</th>
                  <th className="py-3 px-3 min-w-[90px]">Pack Size</th>
                  <th className="py-3 px-4 min-w-[140px] text-center">Qty</th>
                  <th className="py-3 px-3 min-w-[80px]">Units</th>
                  <th className="py-3 px-3 min-w-[75px] text-right">MRP (₹)</th>
                  <th className="py-3 px-3 min-w-[130px]">Expiry</th>
                  <th className="py-3 px-3 min-w-[85px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((r) => {
                  const expStatus = getExpiryStatus(r.expiry_month, r.expiry_year);
                  const expMonthStr = String(r.expiry_month).padStart(2, "0");

                  return (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      {/* Item Name */}
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {r.item_name}
                      </td>

                      {/* Manufacturer */}
                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        {r.manufacturer}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {r.type}
                        </span>
                      </td>

                      {/* Batch No */}
                      <td className="py-3 px-3 font-mono text-xs font-semibold text-primary">
                        {r.batch_code}
                      </td>

                      {/* Pack Size */}
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {r.pack_size}
                      </td>

                      {/* Qty Stepper */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-muted/40 rounded-lg p-1 border border-border/50">
                          <button
                            type="button"
                            disabled={adjustQty.isPending || r.no_of_pack <= 0}
                            onClick={() => {
                              const next = Math.max(0, Number(r.no_of_pack) - 1);
                              adjustQty.mutate({ id: r.id, newQty: next });
                            }}
                            className="h-6 w-6 rounded-md border bg-card flex items-center justify-center text-foreground hover:bg-accent active:scale-95 disabled:opacity-40 transition-transform"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <span className="min-w-10 text-center font-bold text-sm text-foreground">
                            {r.no_of_pack}
                          </span>

                          <button
                            type="button"
                            disabled={adjustQty.isPending}
                            onClick={() => {
                              const next = Number(r.no_of_pack) + 1;
                              adjustQty.mutate({ id: r.id, newQty: next });
                            }}
                            className="h-6 w-6 rounded-md border bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>

                      {/* Units */}
                      <td className="py-3 px-3 text-muted-foreground text-xs">
                        {r.units}
                      </td>

                      {/* MRP */}
                      <td className="py-3 px-3 text-right font-medium text-foreground">
                        ₹{r.mrp}
                      </td>

                      {/* Expiry */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-medium">
                            {expMonthStr}/{r.expiry_year}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border whitespace-nowrap ${expStatus.color}`}>
                            {expStatus.label}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Edit medicine"
                            onClick={() => setEditRow({ ...r })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Delete medicine"
                            onClick={() => setDeleteRow(r)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog: Specifically designed for correcting Qty, Expiry Date, Batch No, etc. */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] max-w-lg rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Medicine Details
            </DialogTitle>
          </DialogHeader>

          {editRow && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate(editRow);
              }}
              className="space-y-4 pt-2"
            >
              {/* Item Name */}
              <div className="space-y-1">
                <Label htmlFor="edit-name" className="text-xs font-medium">Medicine Name *</Label>
                <Input
                  id="edit-name"
                  required
                  value={editRow.item_name}
                  onChange={(e) => setEditRow({ ...editRow, item_name: e.target.value })}
                />
              </div>

              {/* Company & Type */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-mfr" className="text-xs font-medium">Manufacturer *</Label>
                  <Input
                    id="edit-mfr"
                    required
                    value={editRow.manufacturer}
                    onChange={(e) => setEditRow({ ...editRow, manufacturer: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-type" className="text-xs font-medium">Type *</Label>
                  <Input
                    id="edit-type"
                    required
                    value={editRow.type}
                    onChange={(e) => setEditRow({ ...editRow, type: e.target.value })}
                  />
                </div>
              </div>

              {/* Batch Code & Pack Size */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-batch" className="text-xs font-medium">Batch No *</Label>
                  <Input
                    id="edit-batch"
                    required
                    value={editRow.batch_code}
                    onChange={(e) => setEditRow({ ...editRow, batch_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-pack-size" className="text-xs font-medium">Pack Size *</Label>
                  <Input
                    id="edit-pack-size"
                    required
                    value={editRow.pack_size}
                    onChange={(e) => setEditRow({ ...editRow, pack_size: e.target.value })}
                  />
                </div>
              </div>

              {/* Qty & Units */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="edit-qty" className="text-xs font-medium">No. of Qty *</Label>
                  <Input
                    id="edit-qty"
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editRow.no_of_pack}
                    onChange={(e) => setEditRow({ ...editRow, no_of_pack: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-units" className="text-xs font-medium">Units *</Label>
                  <Input
                    id="edit-units"
                    required
                    value={editRow.units}
                    onChange={(e) => setEditRow({ ...editRow, units: e.target.value })}
                  />
                </div>
              </div>

              {/* Expiry Date Section: Specifically formatted for easy error correction */}
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> Correct Expiry Date
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Month</Label>
                    <Select
                      value={String(editRow.expiry_month)}
                      onValueChange={(v) => setEditRow({ ...editRow, expiry_month: Number(v) })}
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={name} value={String(i + 1)}>
                            {String(i + 1).padStart(2, "0")} - {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Year</Label>
                    <Select
                      value={String(editRow.expiry_year)}
                      onValueChange={(v) => setEditRow({ ...editRow, expiry_year: Number(v) })}
                    >
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

              {/* MRP */}
              <div className="space-y-1">
                <Label htmlFor="edit-mrp" className="text-xs font-medium">MRP (₹) *</Label>
                <Input
                  id="edit-mrp"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={editRow.mrp}
                  onChange={(e) => setEditRow({ ...editRow, mrp: Number(e.target.value) })}
                />
              </div>

              <DialogFooter className="gap-2 pt-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete medicine?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete <span className="font-semibold text-foreground">“{deleteRow?.item_name}”</span> (Batch {deleteRow?.batch_code})? This will be permanently removed from the Supabase database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRow) del.mutate(deleteRow.id);
                setDeleteRow(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
