import type { MetadataRoute } from "next";
import { brand } from "@/content/copy";

// The Home Screen icon on Android; iOS uses app/apple-icon.png. No start_url
// or display, so a pass saved to the Home Screen opens on that pass, in the
// browser, like a bookmark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.siteName,
    short_name: "Backyard",
    background_color: "#1f5d36",
    theme_color: "#2f5b3b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
