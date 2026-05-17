import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WSDOT Toll Rates Map",
  description:
    "Live Washington State DOT express toll lane prices rendered on an interactive map.",
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
