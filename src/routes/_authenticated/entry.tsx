import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AddMedicineForm } from "@/components/AddMedicineForm";

export const Route = createFileRoute("/_authenticated/entry")({
  head: () => ({
    meta: [
      { title: "Data Entry | RSP Medical Billing" },
      { name: "description", content: "Smart Barcode Product Auto-Import and Inventory Data Entry." },
      { property: "og:title", content: "Data Entry | RSP Medical Billing" },
    ],
  }),
  component: EntryPage,
});

function EntryPage() {
  const recent = useQuery({
    queryKey: ["recent-entries"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("inventory")
          .select("id, item_name, manufacturer, batch_code, no_of_pack, units, mrp, expiry_month, expiry_year, created_at")
          .order("created_at", { ascending: false })
          .limit(6);
        if (error) return [];
        return (data ?? []) as any[];
      } catch {
        return [];
      }
    },
  });

  const exportExcel = () => {
    if (!recent.data || recent.data.length === 0) return;
    const head = ["Item Name", "Manufacturer", "Batch Code", "Qty", "Units", "MRP", "Expiry"];
    const lines = recent.data.map((r) =>
      [
        r.item_name,
        r.manufacturer,
        r.batch_code,
        r.no_of_pack,
        r.units,
        r.mrp,
        `${String(r.expiry_month).padStart(2, "0")}/${r.expiry_year}`,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `data-entry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5 pb-12 max-w-4xl mx-auto">
      {/* Header Banner matching user's screen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold md:text-2xl text-foreground">Data Entry</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scan a barcode — name, brand, unit and MRP fill in when available.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={exportExcel}
          className="h-9 gap-1.5 shadow-2xs"
          disabled={!recent.data || recent.data.length === 0}
        >
          <Download className="h-4 w-4" />
          <span>Download Excel ({recent.data?.length || 0})</span>
        </Button>
      </div>

      {/* Main Unified Add Medicine Form with Barcode Auto-Import & Dual Modes */}
      <AddMedicineForm standalone={true} />

      {/* Recent Entries */}
      <div className="surface-card p-4 md:p-6 border">
        <h2 className="text-base font-semibold text-foreground">Recent entries</h2>
        {recent.data?.length ? (
          <ul className="mt-3 divide-y text-sm">
            {recent.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-semibold text-foreground">{r.item_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.manufacturer} · Qty: <span className="font-medium text-foreground">{r.no_of_pack} {r.units}</span> · Batch: <span className="font-mono">{r.batch_code}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-primary block">₹{r.mrp}</span>
                  <span className="text-[11px] text-muted-foreground">
                    Exp {String(r.expiry_month).padStart(2, "0")}/{r.expiry_year}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No entries yet. Scan a barcode above to add one.</p>
        )}
      </div>
    </div>
  );
}
