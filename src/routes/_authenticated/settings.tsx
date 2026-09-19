import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { checkSheetConnection, retryUnsynced, saveSheetSettings } from "@/lib/inventory.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Admin Settings | Medicine Inventory" },
      { name: "description", content: "Connect the Google Sheet that receives every inventory submission." },
      { property: "og:title", content: "Admin Settings | Medicine Inventory" },
      { property: "og:description", content: "Connect the Google Sheet that receives every inventory submission." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAuth();
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const saveFn = useServerFn(saveSheetSettings);
  const checkFn = useServerFn(checkSheetConnection);
  const retryFn = useServerFn(retryUnsynced);

  const refresh = async () => {
    try {
      const res = await checkFn({});
      if (!res.configured) return setStatus("No Google Sheet connected yet.");
      setSheetName(res.sheetName);
      setSheetUrl(`https://docs.google.com/spreadsheets/d/${res.spreadsheetId}/edit`);
      setStatus(res.ok ? `Connected to "${res.title}" — tab "${res.sheetName}".` : `Problem reaching the sheet: ${res.error}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not check the sheet");
    }
  };

  useEffect(() => {
    if (isAdmin) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only an admin can change these settings.</p>;

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveFn({ data: { sheetUrl, sheetName } });
      toast.success(`Connected to "${res.title}"`);
      setStatus(`Connected to "${res.title}" — tab "${sheetName}" (header row ${res.header}).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect the sheet");
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      const res = await retryFn({});
      toast.success(res.sent ? `Sent ${res.sent} pending record(s) to the sheet` : "Nothing pending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">Connect the Google Sheet that receives every submission.</p>
      </div>

      <form onSubmit={connect} className="surface-card space-y-4 p-4 md:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="sheetUrl" className="field-label">Google Sheet link</Label>
          <Input id="sheetUrl" className="touch-control" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sheetName" className="field-label">Tab name</Label>
          <Input id="sheetName" className="touch-control" value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Sheet1" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={busy}>Connect sheet</Button>
          <Button type="button" variant="outline" size="xl" className="w-full sm:w-auto" disabled={busy} onClick={refresh}>Check connection</Button>
          <Button type="button" variant="soft" size="xl" className="w-full sm:w-auto" disabled={busy} onClick={retry}>Resend pending rows</Button>
        </div>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </form>
    </div>
  );
}
