import { BRAND_NAME } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="border-t bg-background py-12">
      <div className="mx-auto max-w-[1320px] px-4">
        <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <p>© 2026 {BRAND_NAME}. All rights reserved.</p>
          <p>Free, private temporary email.</p>
        </div>
      </div>
    </footer>
  );
}
