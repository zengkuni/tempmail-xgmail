import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NotFound } from "@/components/shared/NotFound";

export const Route = createFileRoute("/$address")({
  component: AddressRedirect,
});

const EMAIL_RE = /^[^\s/@]+@[^\s/@]+$/;

// Direct hits on /<email> (bookmarks, history, shared links) reopen that
// inbox on the home page instead of falling through to the 404 page.
function AddressRedirect() {
  const { address } = Route.useParams();
  if (!EMAIL_RE.test(address)) {
    return <NotFound status={404} />;
  }
  return <Navigate to="/" search={{ address }} replace />;
}
