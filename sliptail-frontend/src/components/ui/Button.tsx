import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
);

Button.displayName = "Button";

export default Button;
