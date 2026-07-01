import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display-family",
  weight: ["500", "600", "700", "800"],
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PersonaLearn",
  description:
    "AI-powered co-pilot for Kenyan CBC educators — lesson planning, resources, and student feedback.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PersonaLearn",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0C6B63" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1018" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
