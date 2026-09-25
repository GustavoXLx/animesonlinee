import { Link } from "@tanstack/react-router";
import { Bookmark, Compass, Home as HomeIcon, User } from "lucide-react";

const ITEMS = [
  { to: "/", i: HomeIcon, l: "Início" },
  { to: "/explorar", i: Compass, l: "Explorar" },
  { to: "/minha-lista", i: Bookmark, l: "Minha lista" },
  { to: "/perfil", i: User, l: "Perfil" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-neutral-950/95 backdrop-blur border-t border-white/5">
      <div className="grid grid-cols-4 py-2">
        {ITEMS.map(({ to, i: Icon, l }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-white" }}
            inactiveProps={{ className: "text-white/50" }}
            className="flex flex-col items-center gap-1 py-1"
          >
            <Icon size={20} />
            <span className="text-[10px]">{l}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
