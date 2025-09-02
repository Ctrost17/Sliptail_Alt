"use client";

import React from "react";

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`bg-gray-100 text-gray-600 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm">
        &copy; {new Date().getFullYear()} Sliptail. All rights reserved.
      </div>
    </footer>
  );
}

