import { Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList, LogOut, PlusCircle, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const items = [
    { to: "/entry", label: "Add", icon: PlusCircle },
    { to: "/records", label: "Records", icon: ClipboardList },
    ...(isAdmin ? [{ to: "/settings", label: "Settings", icon: Settings }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <span className="text-base font-semibold text-primary">Medicine Inventory</span>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary" }}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile?.name}
              {isAdmin ? " (Admin)" : ""}
            </span>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card md:hidden">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className="flex flex-col items-center gap-1 py-2.5 text-xs text-muted-foreground"
            activeProps={{ className: "flex flex-col items-center gap-1 py-2.5 text-xs text-primary font-semibold" }}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
