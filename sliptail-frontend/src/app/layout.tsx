import type { Metadata } from "next";
import "@/app/globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Sliptail",
  description: "Memberships, downloads, and custom requests for creators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        {/* Wrap the entire app with AuthProvider so useAuth works anywhere */}
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}