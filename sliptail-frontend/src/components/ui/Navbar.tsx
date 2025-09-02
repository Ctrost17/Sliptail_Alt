import React from "react";

export interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

export default function Navbar({ children, className = "" }: NavbarProps) {
  return (
    <nav className={`flex items-center justify-between bg-gray-800 p-4 text-white ${className}`}>
      {children}
    </nav>
  );
}
