import type { Metadata, Viewport } from "next";
import { Archivo, Caveat_Brush, Instrument_Serif } from "next/font/google";
import { brand } from "@/content/copy";
import { series } from "@/content/series";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["wdth"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const caveatBrush = Caveat_Brush({
  variable: "--font-brush-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: brand.siteName,
  title: {
    default: brand.siteName,
    template: `%s · ${brand.siteName}`,
  },
  description: `${brand.line}. ${series.tagline.join(" | ")}. A free community BBQ in Singapore, every month.`,
  openGraph: {
    siteName: brand.siteName,
    title: brand.siteName,
    description: `${series.tagline.join(" | ")} — ${brand.line}.`,
    type: "website",
    locale: "en_SG",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f5b3b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrumentSerif.variable} ${caveatBrush.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
