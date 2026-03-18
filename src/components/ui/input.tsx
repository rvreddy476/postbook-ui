import { cn } from "@/lib/utils"
import { forwardRef } from "react"

const Input = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-xl border border-brand-text/20 bg-brand-card/80 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-brand-text/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text/50 focus-visible:border-brand-text/50 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
