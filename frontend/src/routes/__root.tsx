import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/shared/Header";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { NotFound } from "@/components/shared/NotFound";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  notFoundComponent: () => <NotFound status={404} />,
  component: () => (
    <TooltipProvider>
      <div className="app-shell min-h-screen">
        <Header />
        <main className="pt-14">
          <Outlet />
        </main>
        <SiteFooter />
      <Toaster />
      </div>
    </TooltipProvider>
  ),
});
