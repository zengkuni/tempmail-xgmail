import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChartColumn,
  CircleHelp,
  Code,
  Globe,
  Inbox,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoIcon from "@/assets/logo-icon.png";

const NAV_LINKS = [
  { label: "Inbox", to: "/", Icon: Inbox },
  { label: "Domains", to: "/domains", Icon: Globe },
  { label: "Statistics", to: "/statistics", Icon: ChartColumn },
  { label: "API", to: "/api", Icon: Code },
  { label: "Help", to: "/help", Icon: CircleHelp },
] as const;

function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getDarkSnapshot = () =>
  document.documentElement.classList.contains("dark");

export function Header() {
  const isDark = useSyncExternalStore(
    subscribeDark,
    getDarkSnapshot,
    () => false,
  );

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("color-scheme", next ? "dark" : "light");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1320px] items-center justify-between gap-4 px-4">
        <Link to="/" aria-label={BRAND_NAME} className="flex h-[38px] items-center">
          <img src={logoIcon} alt={BRAND_NAME} className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-2.5">
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map(({ label, to, Icon }) => (
              <Button
                key={to}
                variant="ghost"
                className="h-9 px-3 text-[14px] font-semibold text-muted-foreground data-[active]:bg-accent data-[active]:text-primary"
                render={
                  <Link
                    to={to}
                    activeOptions={{ exact: to === "/" }}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" aria-label="Menu" className="lg:hidden" />
              }
            >
              <Menu className="h-[18px] w-[18px]" />
              Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 lg:hidden">
              {NAV_LINKS.map(({ label, to, Icon }) => (
                <DropdownMenuItem
                  key={to}
                  render={
                    <Link to={to} activeOptions={{ exact: to === "/" }} />
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
