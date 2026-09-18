// Server-only Google Sheets helpers (called from createServerFn handlers).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export const SHEET_HEADERS = [
  "User Name",
  "Item Name",
  "MFR",
  "TYPE",
  "Batch Code",
  "Pack Size",
  "No. of Pack",
  "Units",
  "MRP",
  "Expiry Month",
  "Expiry Year",
  "Expiry (MM/YYYY)",
  "Entered At",
];

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const sheetsKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !sheetsKey) {
    throw new Error("Google Sheets connection is not configured on the server.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    "Content-Type": "application/json",
  };
}

async function gateway(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets request failed [${res.status}]: ${body}`);
    let msg = body;
    try {
      msg = JSON.parse(body)?.error?.message ?? body;
    } catch {
      /* raw */
    }
    throw new Error(`Google Sheets error (${res.status}): ${msg.slice(0, 300)}`);
  }
  return res.json();
}

function quoteSheet(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function getSpreadsheetInfo(spreadsheetId: string) {
  const data = await gateway(`/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`);
  return {
    title: data.properties?.title as string,
    sheets: (data.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title) as string[],
  };
}

export async function ensureHeaderRow(spreadsheetId: string, sheetName: string) {
  const range = `${quoteSheet(sheetName)}!A1:M1`;
  const data = await gateway(`/spreadsheets/${spreadsheetId}/values/${range}`);
  const first: string[] = data.values?.[0] ?? [];
  if (first.length === 0) {
    await gateway(`/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    });
    return "created" as const;
  }
  return "exists" as const;
}

export async function appendRows(spreadsheetId: string, sheetName: string, rows: (string | number)[][]) {
  const range = `${quoteSheet(sheetName)}!A:M`;
  await gateway(
    `/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
}
