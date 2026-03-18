"use client"

import { motion } from "framer-motion"

interface EmptyTabStateProps {
    icon: React.ReactNode
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
    className?: string
}

export function EmptyTabState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    className = "",
}: EmptyTabStateProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`flex flex-col items-center justify-center py-20 px-4 ${className}`}
        >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-secondary mb-5">
                <div className="w-12 h-12 text-brand-text/30 flex items-center justify-center [&>svg]:w-12 [&>svg]:h-12">
                    {icon}
                </div>
            </div>

            <h3 className="text-lg font-semibold text-brand-text text-center">
                {title}
            </h3>

            <p className="mt-2 text-sm text-brand-highlight max-w-sm text-center leading-relaxed">
                {description}
            </p>

            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-6 inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-text text-white text-sm font-medium hover:bg-brand-text transition-colors focus:outline-none focus:ring-2 focus:ring-brand-text/50 focus:ring-offset-2"
                >
                    {actionLabel}
                </button>
            )}
        </motion.div>
    )
}
