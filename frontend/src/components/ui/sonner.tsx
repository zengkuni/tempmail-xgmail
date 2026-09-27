import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// No next-themes here: the app toggles `.dark` on <html> manually (Header /
// index.html). Toast colors come from the CSS vars below, which already follow
// the active scheme.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-green-500" />
        ),
        info: (
          <InfoIcon className="size-4 text-blue-500" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-amber-500" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-red-500" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // c-sonner-12 style: accent left border + colored icon per toast type,
      // plus semantic text colors so the message reads at a glance.
      toastOptions={{
        classNames: {
          toast: "cn-toast border-l-4",
          success:
            "border-l-green-500! [&_[data-title]]:text-green-700! dark:[&_[data-title]]:text-green-400! [&_[data-description]]:text-green-600! dark:[&_[data-description]]:text-green-300/90!",
          info: "border-l-blue-500! [&_[data-title]]:text-blue-700! dark:[&_[data-title]]:text-blue-400! [&_[data-description]]:text-blue-600! dark:[&_[data-description]]:text-blue-300/90!",
          warning:
            "border-l-amber-500! [&_[data-title]]:text-amber-700! dark:[&_[data-title]]:text-amber-400! [&_[data-description]]:text-amber-600! dark:[&_[data-description]]:text-amber-300/90!",
          error:
            "border-l-red-500! [&_[data-title]]:text-red-700! dark:[&_[data-title]]:text-red-400! [&_[data-description]]:text-red-600! dark:[&_[data-description]]:text-red-300/90!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
