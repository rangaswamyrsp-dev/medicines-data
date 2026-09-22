import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLookups } from "@/hooks/useLookups";
import { ComboboxWithAdd } from "@/components/ComboboxWithAdd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/entry")({
  head: () => ({
    meta: [
      { title: "Add Inventory | Medicine Inventory" },
      { name: "description", content: "Add medicine stock entries saved directly to Supabase PostgreSQL." },
      { property: "og:title", content: "Add Inventory | Medicine Inventory" },
      { property: "og:description", content: "Add medicine stock entries saved directly to Supabase PostgreSQL." },
    ],
  }),
  component: EntryPage,
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() + i);

const empty = {
  item_name: "",
  manufacturer: "",
  type: "",
  batch_code: "",
  pack_size: "",
  no_of_pack: "",
  units: "",
  mrp: "",
  expiry_month: "",
  expiry_year: "",
};

function EntryPage() {
  const [form, setForm] = useState({ ...empty });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const itemRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { manufacturers, types, units, addLookup } = useLookups();

  useEffect(() => {
    itemRef.current?.focus();
  }, []);

  const recent = useQuery({
    queryKey: ["recent-entries"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("id, item_name, manufacturer, batch_code, no_of_pack, units, expiry_month, expiry_year, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  const set = (k: keyof typeof empty, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Database request timed out. Please verify your internet connection or check Supabase."
              )
            ),
          10000
        )
      );

      const insertPromise = supabase
        .from("inventory")
        .insert({
          user_name: "Operator",
          item_name: form.item_name.trim(),
          manufacturer: form.manufacturer.trim(),
          type: form.type.trim(),
          batch_code: form.batch_code.trim(),
          pack_size: form.pack_size.trim(),
          no_of_pack: Number(form.no_of_pack),
          units: form.units.trim(),
          mrp: Number(form.mrp),
          expiry_month: Number(form.expiry_month),
          expiry_year: Number(form.expiry_year),
        })
        .select()
        .single();

      const res: any = await Promise.race([insertPromise, timeoutPromise]);
      if (res?.error) {
        console.error("Supabase insert error:", res.error);
        const errMsg = res.error.message || res.error.details || "Database error saving medicine";
        throw new Error(errMsg);
      }

      setForm({ ...empty });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      itemRef.current?.focus();
      qc.invalidateQueries({ queryKey: ["recent-entries"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["inventory-distinct-lookups"] });
      toast.success("Medicine added to database successfully!");
    } catch (err: any) {
      console.error("Submit error:", err);
      const msg = err?.message || (typeof err === "string" ? err : "Could not save the record");
      toast.error(msg, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Add Medicine Stock</h1>
        <p className="text-xs text-muted-foreground">Entries are saved directly to your Supabase PostgreSQL database.</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-3 text-sm font-medium text-[hsl(var(--success))]">
          <CheckCircle2 className="h-5 w-5" /> ✅ Medicine added successfully
        </div>
      )}

      <form onSubmit={submit} className="surface-card space-y-4 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="item_name" className="field-label">Item Name <span className="text-destructive">*</span></Label>
            <Input id="item_name" ref={itemRef} required className="touch-control" value={form.item_name} onChange={(e) => set("item_name", e.target.value)} placeholder="e.g. Paracetamol 500mg" />
          </div>

          <ComboboxWithAdd id="manufacturer" label="Manufacturer" value={form.manufacturer} onChange={(v) => set("manufacturer", v)} options={manufacturers} onAdd={(n) => addLookup("manufacturers", n)} addTitle="Add New Manufacturer" placeholder="Select manufacturer" error={errors["manufacturer"]} />
          <div className="space-y-1.5">
            <Label htmlFor="batch_code" className="field-label">Batch Code <span className="text-destructive">*</span></Label>
            <Input id="batch_code" required className="touch-control" value={form.batch_code} onChange={(e) => set("batch_code", e.target.value)} />
          </div>
          <ComboboxWithAdd id="type" label="Type" value={form.type} onChange={(v) => set("type", v)} options={types} onAdd={(n) => addLookup("types", n)} addTitle="Add New Type" placeholder="Select type" error={errors["type"]} />

          <div className="space-y-1.5">
            <Label htmlFor="pack_size" className="field-label">Pack Size <span className="text-destructive">*</span></Label>
            <Input id="pack_size" required className="touch-control" value={form.pack_size} onChange={(e) => set("pack_size", e.target.value)} placeholder="e.g. 10x10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="no_of_pack" className="field-label">No. of Qty <span className="text-destructive">*</span></Label>
            <Input id="no_of_pack" type="number" inputMode="decimal" min="0" step="any" required className="touch-control" value={form.no_of_pack} onChange={(e) => set("no_of_pack", e.target.value)} placeholder="e.g. 10" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="units" className="field-label">Units <span className="text-destructive">*</span></Label>
              <span className="text-[11px] text-muted-foreground">Type any format (e.g. 30ml, 500gm, 5g, 1)</span>
            </div>
            <Input
              id="units"
              required
              className="touch-control"
              value={form.units}
              onChange={(e) => set("units", e.target.value)}
              placeholder="e.g. 30ml, 50ml, 500gm, 5g, 1, Tablets"
              list="units-suggestions"
              autoComplete="off"
            />
            <datalist id="units-suggestions">
              {units.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["30ml", "50ml", "80ml", "100ml", "500gm", "5g", "Tablets", "Capsules", "Bottles", "Strips", "1"].map((quickUnit) => (
                <button
                  key={quickUnit}
                  type="button"
                  onClick={() => set("units", quickUnit)}
                  className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
                    form.units === quickUnit
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  {quickUnit}
                </button>
              ))}
            </div>
            {errors["units"] && <p className="text-sm text-destructive">{errors["units"]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mrp" className="field-label">MRP <span className="text-destructive">*</span></Label>
            <Input id="mrp" type="number" inputMode="decimal" min="0" step="any" required className="touch-control" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="field-label">Expiry Month <span className="text-destructive">*</span></Label>
              <Select value={form.expiry_month} onValueChange={(v) => set("expiry_month", v)}>
                <SelectTrigger className="touch-control"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{String(i + 1).padStart(2, "0")} — {m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="field-label">Expiry Year <span className="text-destructive">*</span></Label>
              <Select value={form.expiry_year} onValueChange={(v) => set("expiry_year", v)}>
                <SelectTrigger className="touch-control"><SelectValue placeholder="Year" /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button type="submit" size="xl" className="w-full text-base font-semibold shadow-sm" disabled={saving}>
          {saving ? "Saving to database…" : "Save to Database"}
        </Button>
      </form>

      <div className="surface-card p-4 md:p-6">
        <h2 className="text-base font-semibold">Recent entries</h2>
        {recent.data?.length ? (
          <ul className="mt-3 divide-y text-sm">
            {recent.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium">{r.item_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.manufacturer} · Qty: <span className="font-semibold text-foreground">{r.no_of_pack} {r.units}</span> · Batch: <span className="font-mono">{r.batch_code}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  Exp {String(r.expiry_month).padStart(2, "0")}/{r.expiry_year}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
