import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Github } from "lucide-react";
import { ThemeProvider } from "next-themes";
import Nav from "@/components/Nav";
import AppFrame from "@/components/AppFrame";
import StoreHydrator from "@/components/StoreHydrator";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { site, siteUrl } from "@/lib/site";
import "./globals.css";
import "./editorial.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: site.title,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  other: { "axis-build": process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  keywords: [...site.keywords],
  authors: [{ name: "AXIS contributors", url: site.github }],
  creator: "AXIS contributors",
  publisher: "AXIS",
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.title,
    description: site.description,
    url: siteUrl,
    locale: site.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: site.name,
              url: siteUrl,
              description: site.description,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              browserRequirements: "Requires JavaScript and WebAssembly.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              author: { "@type": "Person", name: "AXIS contributors", url: site.github },
              inLanguage: ["en", "fr"],
            }),
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <I18nProvider>
            <StoreHydrator />
            <Toaster />
            <a href="#main-content" className="axis-skip-link">Skip to content</a>
            <AppFrame>
            <Nav />
            <div id="main-content" className="axis-content flex-1" tabIndex={-1}>{children}</div>
            <footer className="axis-footer">
              <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  AXIS · built on Chess Coach by{" "}
                  <a
                    href="https://www.chess.com/member/ln_dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground underline transition"
                  >
                    LN Dev
                  </a>
                </span>
                <div className="flex items-center gap-5">
                  <a href="/licenses" className="hover:text-foreground transition">Licenses</a>
                  <a
                    href={site.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition"
                  >
                    <Github className="size-3.5" />
                    GitHub
                  </a>

                </div>
              </div>
            </footer>
            </AppFrame>
          </I18nProvider>
        </ThemeProvider>
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
