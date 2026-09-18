import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onAdd: (name: string) => Promise<string>;
  placeholder?: string;
  addTitle: string;
  error?: string;
}

export function ComboboxWithAdd({ id, label, value, onChange, options, onAdd, placeholder, addTitle, error }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const openAdd = (prefill = "") => {
    setNewName(prefill);
    setOpen(false);
    setAddOpen(true);
  };

  const saveNew = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const saved = await onAdd(newName);
      onChange(saved);
      setAddOpen(false);
      setNewName("");
      toast.success(`${label} "${saved}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not add ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const hasExactMatch = options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="field-label">
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={!!error}
              className={cn(
                "touch-control flex-1 justify-between font-normal",
                !value && "text-muted-foreground",
                error && "border-destructive",
              )}
            >
              <span className="truncate">{value || placeholder || `Select ${label.toLowerCase()}`}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}…`} value={search} onValueChange={setSearch} className="h-11" />
              <CommandList className="max-h-64">
                <CommandEmpty className="p-2">
                  <Button type="button" variant="secondary" className="w-full" onClick={() => openAdd(search)}>
                    <Plus className="h-4 w-4" /> Add "{search.trim()}"
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt}
                      value={opt}
                      className="py-3 text-base"
                      onSelect={() => {
                        onChange(opt);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                      {opt}
                    </CommandItem>
                  ))}
                  {search.trim() && !hasExactMatch && options.length > 0 && (
                    <CommandItem value={`__add__${search}`} className="py-3 text-primary" onSelect={() => openAdd(search)}>
                      <Plus className="mr-2 h-4 w-4" /> Add "{search.trim()}"
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button type="button" variant="soft" className="touch-control shrink-0 px-3" onClick={() => openAdd()} aria-label={addTitle}>
          <Plus className="h-5 w-5" />
          <span className="hidden sm:inline">Add New</span>
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{addTitle}</DialogTitle>
            <DialogDescription>It will be saved and selected in the form right away.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            className="touch-control"
            placeholder={`${label} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveNew();
              }
            }}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveNew} disabled={saving || !newName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
