"use client";

import Link from "next/link";
import React from "react";

interface NavbarLink {
  href: string;
  label: string;
}

interface NavbarProps {
  links?: NavbarLink[];
}

export function Navbar({ links = [] }: NavbarProps) {
  return (
    <nav className="bg-gray-800 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Sliptail
        </Link>
        <div className="space-x-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

