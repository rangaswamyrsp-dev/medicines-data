import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
      { title: "Records | Medicine Inventory" },
      { name: "description", content: "Browse, filter, edit and export saved medicine inventory records." },
      { property: "og:title", content: "Records | Medicine Inventory" },
      { property: "og:description", content: "Browse, filter, edit and export saved medicine inventory records." },
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
  sheet_synced: boolean;
  created_at: string;
};

const ALL = "__all__";

function RecordsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [fUser, setFUser] = useState(ALL);
  const [fMfr, setFMfr] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [fYear, setFYear] = useState(ALL);
  const [fBatch, setFBatch] = useState("");
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as Row[];
    },
  });

  const uniq = (vals: (string | number)[]) => Array.from(new Set(vals.map(String))).sort();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fUser !== ALL && r.user_name !== fUser) return false;
      if (fMfr !== ALL && r.manufacturer !== fMfr) return false;
      if (fType !== ALL && r.type !== fType) return false;
      if (fYear !== ALL && String(r.expiry_year) !== fYear) return false;
      if (fBatch && !r.batch_code.toLowerCase().includes(fBatch.trim().toLowerCase())) return false;
      if (q && ![r.item_name, r.manufacturer, r.type, r.batch_code, r.user_name].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, fUser, fMfr, fType, fYear, fBatch]);

  const today = new Date().toDateString();
  const todayCount = rows.filter((r) => new Date(r.created_at).toDateString() === today).length;
  const perUser = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.user_name, (m.get(r.user_name) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record deleted");
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["recent-entries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("inventory")
        .update({
          item_name: row.item_name,
          manufacturer: row.manufacturer,
          type: row.type,
          batch_code: row.batch_code,
          pack_size: row.pack_size,
          no_of_pack: Number(row.no_of_pack),
          units: row.units,
          mrp: Number(row.mrp),
          expiry_month: Number(row.expiry_month),
          expiry_year: Number(row.expiry_year),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record updated");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = () => {
    const head = ["User Name", "Item Name", "MFR", "TYPE", "Batch Code", "Pack Size", "No. of Pack", "Units", "MRP", "Expiry", "Entered At"];
    const lines = filtered.map((r) =>
      [r.user_name, r.item_name, r.manufacturer, r.type, r.batch_code, r.pack_size, r.no_of_pack, r.units, r.mrp, `${String(r.expiry_month).padStart(2, "0")}/${r.expiry_year}`, new Date(r.created_at).toLocaleString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Records</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "All users' records" : "Your records"}</p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total records" value={rows.length} />
        <Stat label="Today's entries" value={todayCount} />
        <Stat label="Showing" value={filtered.length} />
        <Stat label="Users" value={perUser.length} />
      </div>

      <div className="surface-card space-y-3 p-4">
        <Input className="touch-control" placeholder="Search item, batch, manufacturer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="grid gap-3 md:grid-cols-5">
          {isAdmin && <Filter label="User" value={fUser} onChange={setFUser} options={uniq(rows.map((r) => r.user_name))} />}
          <Filter label="Manufacturer" value={fMfr} onChange={setFMfr} options={uniq(rows.map((r) => r.manufacturer))} />
          <Filter label="Type" value={fType} onChange={setFType} options={uniq(rows.map((r) => r.type))} />
          <Filter label="Expiry Year" value={fYear} onChange={setFYear} options={uniq(rows.map((r) => r.expiry_year))} />
          <div className="space-y-1.5">
            <Label className="field-label">Batch Code</Label>
            <Input className="touch-control" value={fBatch} onChange={(e) => setFBatch(e.target.value)} placeholder="Batch" />
          </div>
        </div>
      </div>

      {isAdmin && perUser.length > 0 && (
        <div className="surface-card p-4">
          <h2 className="text-base font-semibold">Entries per user</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {perUser.map(([u, c]) => (
              <li key={u} className="rounded-full bg-primary/10 px-3 py-1 text-primary">{u}: {c}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading records…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records match these filters.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="surface-card flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.item_name}</p>
                <p className="text-sm text-muted-foreground">{r.manufacturer} · {r.type} · Batch {r.batch_code}</p>
                <p className="text-sm text-muted-foreground">
                  {r.pack_size} · {r.no_of_pack} {r.units} · ₹{r.mrp} · Exp {String(r.expiry_month).padStart(2, "0")}/{r.expiry_year}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.user_name} · {new Date(r.created_at).toLocaleString()} · {r.sheet_synced ? "in sheet" : "not in sheet"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Edit" onClick={() => setEditRow(r)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" aria-label="Delete" onClick={() => setDeleteRow(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit record</DialogTitle></DialogHeader>
          {editRow && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["item_name", "Item Name"],
                ["manufacturer", "Manufacturer"],
                ["type", "Type"],
                ["batch_code", "Batch Code"],
                ["pack_size", "Pack Size"],
                ["no_of_pack", "No. of Pack"],
                ["units", "Units"],
                ["mrp", "MRP"],
                ["expiry_month", "Expiry Month"],
                ["expiry_year", "Expiry Year"],
              ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label className="field-label">{label}</Label>
                  <Input
                    className="touch-control"
                    value={String(editRow[k])}
                    onChange={(e) => setEditRow({ ...editRow, [k]: e.target.value } as Row)}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button disabled={update.isPending} onClick={() => editRow && update.mutate(editRow)}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteRow?.item_name}” will be removed from the app. The row already sent to the Google Sheet stays there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-3 text-center">
      <p className="text-2xl font-semibold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="field-label">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="touch-control"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
