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
          "relative inline-flex h-10 items-center justify-center overflow-hidden rounded-md px-6 font-medium text-sm transition-all duration-300",
          variant === "primary" 
            ? "bg-white text-black hover:bg-zinc-200" 
            : "border border-zinc-700 bg-transparent text-white hover:bg-zinc-800",
          className,
        )}
        {...props}
      >
        <span className="relative z-10">{children}</span>
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
