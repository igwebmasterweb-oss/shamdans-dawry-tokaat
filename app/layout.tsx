import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const tajawal = Tajawal({ 
  subsets: ["arabic"], 
  weight: ["400", "500", "700"],
  variable: "--font-tajawal" 
});

export const metadata: Metadata = {
  title: "الشمعدان × كأس العالم 2026 | دوري التوقعات",
  description: "أحلى من الماتش.. اللي بيحصل جنبيه",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${inter.variable} ${tajawal.variable} font-tajawal bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}