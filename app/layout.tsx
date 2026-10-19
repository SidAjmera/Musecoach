import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Musecoach — Make room for your voice",
  description:
    "A personal singing studio. Record, understand your voice, and build a practice that feels like you.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
