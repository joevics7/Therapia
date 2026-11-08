import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { QuickExitProvider } from "@/components/QuickExit";

export const metadata: Metadata = {
  title: "Therapia",
  description: "Anonymous voice support groups. Say it out loud. Nobody has to know it's you.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <AuthProvider><QuickExitProvider><main className="shell">{children}</main></QuickExitProvider></AuthProvider>
      </body>
    </html>
  );
}
