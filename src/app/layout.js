import AuthProvider from "../components/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "SEOJUMP - ¡Domina el SEO jugando!",
  description: "La forma más divertida de aprender y aplicar SEO en tu sitio web.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem("seojump_theme");
                if (savedTheme === "dark") {
                  document.documentElement.classList.add("dark");
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

