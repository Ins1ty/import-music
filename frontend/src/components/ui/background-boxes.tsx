"use client"

import React from "react"
import { useTheme } from "@/components/theme-provider"

const colors = [
  "#93c5fd",
  "#f9a8d4",
  "#86efac",
  "#fde047",
  "#fca5a5",
  "#d8b4fe",
  "#93c5fd",
  "#a5b4fc",
  "#c4b5fd",
]

export const BoxesCore = ({ className, ...rest }: { className?: string }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const rows = new Array(150).fill(1)
  const cols = new Array(100).fill(1)
  
  const getRandomColor = (i: number, j: number) => {
    return colors[(i + j) % colors.length]
  }

  return (
    <div
      style={{
        transform: `translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) rotate(0deg) translateZ(0)`,
        backgroundColor: isDark ? '#020617' : '#f1f5f9',
      }}
      className={className}
      {...rest}
    >
      {rows.map((_, i) => (
        <div
          key={`row` + i}
          className="relative h-8 w-16"
          style={{ borderLeftColor: isDark ? '#1e293b' : '#e2e8f0' }}
        >
          {cols.map((_, j) => (
            <div
              key={`col` + j}
              className="relative h-8 w-16"
              style={{
                borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
                borderRightColor: isDark ? '#1e293b' : '#e2e8f0',
              }}
            >
              {j % 2 === 0 && i % 2 === 0 ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="pointer-events-none absolute -top-[14px] -left-[22px] h-6 w-10 stroke-[1px]"
                  style={{ color: isDark ? '#1e293b' : '#e2e8f0' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m6-6H6"
                  />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const Boxes = React.memo(BoxesCore)
