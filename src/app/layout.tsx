import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raha — Mental Wellness Circle",
  description: "A gentle space to pause, talk, and feel heard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
