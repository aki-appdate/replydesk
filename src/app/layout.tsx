import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ReplyDesk｜問い合わせ対応のAI返信アシスタント",
  description: "マニュアルを根拠にAIが返信案を作り、担当者が確認して送る問い合わせ対応のデモアプリ（データはすべて架空）",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${noto.variable} h-full`}>
      <body className="min-h-full">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
