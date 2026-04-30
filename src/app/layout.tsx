import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Generic MSIG",
  description: "Generic MSIG interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
