import React from "react";

export interface FooterProps {
  children: React.ReactNode;
  className?: string;
}

export default function Footer({ children, className = "" }: FooterProps) {
  return (
    <footer className={`bg-gray-100 p-4 text-center text-sm text-gray-500 ${className}`}>
      {children}
    </footer>
  );
}
