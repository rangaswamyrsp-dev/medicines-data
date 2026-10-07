import { useState, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { Search, Upload, FileSpreadsheet, Package, X, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/box-finder")({
  head: () => ({
    meta: [
      { title: "Box Finder | Medicine Stock" },
      { name: "description", content: "Import medicine list from Excel and find box numbers by searching medicine names." },
    ],
  }),
  component: BoxFinderPage,
});

type MedicineBox = {
  id: string;
  item_name: string;
  box_no: string;
};

const LOCAL_STORAGE_KEY = "rsp_box_finder_data_v1";

function loadFromStorage(): MedicineBox[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(data: MedicineBox[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function BoxFinderPage() {
  const [medicines, setMedicines] = useState<MedicineBox[]>(() => loadFromStorage());
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importStats, setImportStats] = useState<{ total: number; imported: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search / filter
  const filtered = searchQuery.trim()
    ? medicines.filter((m) =>
        m.item_name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : medicines;

  // Excel parser
  const processFile = useCallback(
    (file: File) => {
      if (!file) return;
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error("Please upload a valid Excel (.xlsx, .xls) or CSV file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          if (!rows.length) {
            toast.error("The spreadsheet appears to be empty.");
            return;
          }

          // Normalise column names case-insensitively
          const colMap = (header: string): string => {
            const h = header.toLowerCase().replace(/[\s_\-]+/g, "");
            if ((h.includes("id") && !h.includes("item")) || h === "itemid") return "id";
            if (h.includes("item") || h.includes("name") || h.includes("medicine")) return "item_name";
            if (h.includes("box") || h.includes("shelf") || h.includes("location")) return "box_no";
            return "";
          };

          const firstRowKeys = Object.keys(rows[0]);
          const mappedKeys: Record<string, string> = {};
          firstRowKeys.forEach((k) => {
            const mapped = colMap(k);
            if (mapped) mappedKeys[k] = mapped;
          });

          const parsed: MedicineBox[] = [];
          for (const row of rows) {
            const entry: any = {};
            for (const [orig, mapped] of Object.entries(mappedKeys)) {
              entry[mapped] = String(row[orig] ?? "").trim();
            }
            if (entry.item_name && entry.box_no) {
              parsed.push({
                id: entry.id || String(parsed.length + 1),
                item_name: entry.item_name,
                box_no: entry.box_no,
              });
            }
          }

          if (!parsed.length) {
            toast.error('No valid rows found. Make sure columns include "Item Name" and "Box No".');
            return;
          }

          setMedicines((prev) => {
            const merged = [...prev];
            let added = 0;
            for (const p of parsed) {
              const exists = merged.find(
                (m) => m.id === p.id || m.item_name.toLowerCase() === p.item_name.toLowerCase()
              );
              if (!exists) {
                merged.push(p);
                added++;
              } else {
                exists.box_no = p.box_no;
              }
            }
            saveToStorage(merged);
            setImportStats({ total: parsed.length, imported: added });
            toast.success(
              `Imported ${parsed.length} records (${added} new, ${parsed.length - added} updated).`
            );
            return merged;
          });
        } catch (err) {
          console.error(err);
          toast.error("Failed to read the Excel file. Please check the format and try again.");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const clearAll = () => {
    setMedicines([]);
    setImportStats(null);
    saveToStorage([]);
    toast.info("All box data cleared.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          Box Finder
        </h1>
        <p className="text-sm text-muted-foreground">
          Import your medicine list from Excel and instantly find any box number.
        </p>
      </div>

      {/* Import zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 p-8",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/60 hover:bg-accent/40",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
          id="excel-upload"
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground">
            {isDragging ? "Drop your Excel file here" : "Upload Excel / CSV"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Drag &amp; drop or click to browse &middot; Required columns:{" "}
            <span className="font-mono text-primary">ID</span>,{" "}
            <span className="font-mono text-primary">Item Name</span>,{" "}
            <span className="font-mono text-primary">Box No</span>
          </p>
        </div>
        <Button variant="outline" size="sm" className="pointer-events-none gap-2">
          <Upload className="h-4 w-4" />
          Choose File
        </Button>
      </div>

      {/* Import stats pill */}
      {importStats && (
        <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <span className="text-green-700 dark:text-green-400 font-medium">
            {importStats.total} records imported &mdash; {importStats.imported} new,{" "}
            {importStats.total - importStats.imported} updated.
          </span>
          <button
            onClick={() => setImportStats(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="box-finder-search"
          placeholder="Type medicine name to find box number…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11 text-base rounded-xl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results */}
      {medicines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No data imported yet.</p>
          <p className="text-xs text-muted-foreground/70">Upload an Excel file above to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No medicines match "{searchQuery}"</p>
          <p className="text-xs text-muted-foreground/70">Try a different name or check the spelling.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
              <span className="font-semibold text-foreground">{medicines.length}</span> medicines
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={clearAll}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </Button>
          </div>

          {/* Big highlight card when exactly one match */}
          {searchQuery && filtered.length === 1 && (
            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  Medicine Found
                </p>
                <p className="text-xl font-bold text-foreground">{filtered[0].item_name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">ID: {filtered[0].id}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  Box Number
                </p>
                <div className="rounded-xl bg-primary px-5 py-2 text-2xl font-black text-primary-foreground tracking-wide shadow-lg">
                  {filtered[0].box_no}
                </div>
              </div>
            </div>
          )}

          {/* Grid cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((med) => (
              <div
                key={med.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground text-sm leading-tight">
                    {med.item_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">ID: {med.id}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-center min-w-[70px]">
                  <p className="text-[10px] text-primary/70 font-medium uppercase tracking-wider leading-none mb-0.5">Box</p>
                  <p className="text-base font-bold text-primary leading-none">{med.box_no}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
