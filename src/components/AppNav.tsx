import { Link } from "@tanstack/react-router";
import { ClipboardList, PlusCircle, Settings } from "lucide-react";

export function AppNav() {
  const items = [
    { to: "/entry", label: "Add Stock", icon: PlusCircle },
    { to: "/records", label: "Records", icon: ClipboardList },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/entry" className="text-base font-bold text-primary flex items-center gap-2">
            <span>💊 Medicine Stock</span>
          </Link>
          <nav className="flex items-center gap-2">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-semibold bg-primary/10 text-primary" }}
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar: Clean 3 tabs with large touch targets */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card/95 backdrop-blur md:hidden shadow-lg pb-safe">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-muted-foreground active:scale-95 transition-transform"
            activeProps={{ className: "flex flex-col items-center justify-center gap-1 py-3 text-xs text-primary font-bold bg-primary/5" }}
          >
            <i.icon className="h-5 w-5" />
            <span>{i.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
