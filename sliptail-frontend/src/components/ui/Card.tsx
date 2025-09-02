"use client";

import React from "react";

interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div className={`rounded-lg border bg-white shadow ${className}`}>
      {title && <div className="border-b p-4 text-lg font-semibold">{title}</div>}
      <div className="p-4">{children}</div>
    </div>
  );
}

