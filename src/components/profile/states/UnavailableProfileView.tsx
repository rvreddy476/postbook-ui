"use client"

import { UserX, Home } from "lucide-react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"

interface UnavailableProfileProps {
    message?: string
}

export function UnavailableProfileView({ message }: UnavailableProfileProps) {
    const router = useRouter()

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen bg-slate-50 flex items-center justify-center px-4"
        >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 sm:p-14 text-center max-w-md w-full">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 mb-6"
                >
                    <UserX className="w-10 h-10 text-slate-300" />
                </motion.div>

                <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                >
                    <h2 className="text-xl font-semibold text-slate-950">
                        This account is unavailable
                    </h2>

                    <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                        {message ?? "The profile you're looking for doesn't exist or has been removed."}
                    </p>
                </motion.div>

                <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                    className="mt-8"
                >
                    <button
                        onClick={() => router.push("/")}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D8103F] text-white text-sm font-medium hover:bg-[#b80d35] transition-colors focus:outline-none focus:ring-2 focus:ring-[#D8103F]/50 focus:ring-offset-2"
                    >
                        <Home className="w-4 h-4" />
                        Go Home
                    </button>
                </motion.div>
            </div>
        </motion.div>
    )
}
