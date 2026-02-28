import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
    size?: "sm" | "md" | "lg"
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "md", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 disabled:pointer-events-none",
                    {
                        "bg-violet-600 text-white hover:bg-violet-700 shadow-sm": variant === "default",
                        "bg-violet-100 text-violet-700 hover:bg-violet-200": variant === "secondary",
                        "border border-violet-200 bg-transparent text-violet-700 hover:bg-violet-50": variant === "outline",
                        "bg-transparent text-violet-700 hover:bg-violet-50": variant === "ghost",
                        "bg-red-500 text-white hover:bg-red-600 shadow-sm": variant === "destructive",
                    },
                    {
                        "h-8 px-3 text-xs gap-1": size === "sm",
                        "h-10 px-4 text-sm gap-2": size === "md",
                        "h-12 px-6 text-base gap-2": size === "lg",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
