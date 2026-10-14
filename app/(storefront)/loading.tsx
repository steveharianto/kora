// Group-level loading fallback. Shown while the server component for the
// target route streams in. Matches PageLoader's visual exactly so the
// handoff from this fallback → actual page (with PageLoader overlay if
// images are still pending) is seamless.

import LoaderShell from "@/components/storefront/LoaderShell";

export default function StorefrontLoading() {
  return <LoaderShell />;
}
