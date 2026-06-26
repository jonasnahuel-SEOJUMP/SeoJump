import AuthProvider from "../components/AuthProvider";
import "./globals.css";
import { getSiteUrl } from "../lib/siteUrl";

// Server actions (IA de títulos, misiones) pueden hacer scrape + Gemini.
export const maxDuration = 60;

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "SEOJUMP - ¡Domina el SEO jugando!",
  description: "La forma más divertida de aprender y aplicar SEO en tu sitio web.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const version = localStorage.getItem("seojump_version");
                if (version !== "1.1") {
                  localStorage.removeItem("seojump_quick_wins");
                  localStorage.removeItem("seojump_quick_wins_url");
                  localStorage.setItem("seojump_version", "1.1");
                }
                const savedTheme = localStorage.getItem("seojump_theme");
                if (savedTheme === "dark") {
                  document.documentElement.classList.add("dark");
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#07070d] text-slate-100 transition-colors duration-300">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

