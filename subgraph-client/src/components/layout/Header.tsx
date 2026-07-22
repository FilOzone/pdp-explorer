import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NetworkSelector } from "@/components/shared/NetworkSelector";
import { useNetwork } from "@/contexts/NetworkContext";
import { cn } from "@/lib/utils";
import { NameLogo } from "./NameLogo";

export function Header() {
  const { network } = useNetwork();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Providers", to: `/${network}/providers` },
    { label: "Datasets", to: `/${network}/datasets` },
    { label: "Services", to: `/${network}/services` },
    { label: "Docs", to: "/documentation" },
    { label: "Gas Calculator", to: "/gas-calculator" },
  ];

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  const desktopLinkClass = (active: boolean) =>
    cn(
      "text-[15px] tracking-wide transition-colors",
      active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  const mobileLinkClass = (active: boolean) =>
    cn(
      "rounded-md p-2 text-sm tracking-wide transition-colors",
      active
        ? "bg-secondary font-medium text-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20 lg:px-8">
        <Link to="/" onClick={closeMobileMenu}>
          <NameLogo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={desktopLinkClass(isActive(item.to))}>
              {item.label}
            </Link>
          ))}
          <a
            href="https://status.filecoin.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className={desktopLinkClass(false)}
            aria-label="Filecoin Cloud Status"
          >
            Status
          </a>
          <NetworkSelector />
        </nav>

        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav className="border-t px-6 py-4 lg:hidden" aria-label="Main">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className={mobileLinkClass(isActive(item.to))} onClick={closeMobileMenu}>
                {item.label}
              </Link>
            ))}
            <a
              href="https://status.filecoin.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className={mobileLinkClass(false)}
              aria-label="Filecoin Cloud Status"
            >
              Status
            </a>
            <div className="pt-3">
              <NetworkSelector />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
