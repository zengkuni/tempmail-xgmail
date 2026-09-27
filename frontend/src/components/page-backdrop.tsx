import { GridPattern } from "@/components/ui/grid-pattern";

// Decorative page background: brand-tinted grid pattern fading out via a
// radial mask, plus two soft gradient orbs. Rendered absolutely inside a
// `relative` page wrapper; content must sit on a positioned element above it.
export function PageBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <GridPattern
        width={48}
        height={48}
        className="fill-transparent stroke-primary/15 [mask-image:radial-gradient(720px_circle_at_25%_10%,white,transparent)]"
      />
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute top-40 -right-32 h-96 w-96 rounded-full bg-success/15 blur-3xl" />
    </div>
  );
}
