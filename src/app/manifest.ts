import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سهيل · Suhail",
    short_name: "سهيل",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    theme_color: "#0B2E33",
    background_color: "#0B2E33",
    icons: [16, 32, 180, 192, 512].map((size) => ({
      src: `/icons/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  };
}
