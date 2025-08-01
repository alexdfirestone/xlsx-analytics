import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthRefresh } from "@/components/auth/AuthRefresh";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "XLSX Analytics",
  description: "Analytics platform for Excel files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-background font-sans antialiased`}>
        <AuthProvider>
          <AuthRefresh />
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
