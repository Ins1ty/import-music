"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg px-6 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50",
          variant === "primary" 
            ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
            : "bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
