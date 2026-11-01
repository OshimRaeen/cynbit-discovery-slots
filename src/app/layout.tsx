import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book a discovery call | Cynbit (prototype)",
  description:
    "A prototype of a self-serve discovery-call booking flow for cynbit.in/services, built for the Full Stack Developer Intern assessment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="bg-brand-dark px-4 py-2 text-center text-xs text-white">
          Prototype for the Cynbit assessment, not an official Cynbit page. Please don&apos;t enter real personal
          details: bookings are deleted after 7 days.
        </div>
        {children}
      </body>
    </html>
  );
}
