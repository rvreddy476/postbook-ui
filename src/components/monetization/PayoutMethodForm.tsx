"use client"

import React, { useState } from "react"

interface PayoutMethodFormProps {
    onSubmit: (payload: { method_type: string; details: Record<string, string> }) => void
    isPending: boolean
}

type MethodType = "upi" | "bank_transfer" | "paypal"

const methodOptions: { value: MethodType; label: string; icon: string }[] = [
    {
        value: "upi",
        label: "UPI",
        icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    },
    {
        value: "bank_transfer",
        label: "Bank Transfer",
        icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    },
    {
        value: "paypal",
        label: "PayPal",
        icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    },
]

const PayoutMethodForm: React.FC<PayoutMethodFormProps> = ({ onSubmit, isPending }) => {
    const [selectedMethod, setSelectedMethod] = useState<MethodType>("upi")
    const [upiId, setUpiId] = useState("")
    const [bankName, setBankName] = useState("")
    const [accountNumber, setAccountNumber] = useState("")
    const [ifscCode, setIfscCode] = useState("")
    const [accountHolder, setAccountHolder] = useState("")
    const [paypalEmail, setPaypalEmail] = useState("")

    const resetFields = () => {
        setUpiId("")
        setBankName("")
        setAccountNumber("")
        setIfscCode("")
        setAccountHolder("")
        setPaypalEmail("")
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        let details: Record<string, string> = {}

        switch (selectedMethod) {
            case "upi":
                if (!upiId.trim()) return
                details = { upi_id: upiId.trim() }
                break
            case "bank_transfer":
                if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim() || !accountHolder.trim()) return
                details = {
                    bank_name: bankName.trim(),
                    account_number: accountNumber.trim(),
                    ifsc_code: ifscCode.trim(),
                    account_holder: accountHolder.trim(),
                }
                break
            case "paypal":
                if (!paypalEmail.trim()) return
                details = { email: paypalEmail.trim() }
                break
        }

        onSubmit({ method_type: selectedMethod, details })
        resetFields()
    }

    const inputClass =
        "w-full px-4 py-3 rounded-xl border border-[#F0E6DC] bg-[#FAF5F0] text-sm font-bold text-[#3C2415] placeholder:text-[#D4A574]/60 focus:outline-none focus:ring-2 focus:ring-[#D4A574]/30 focus:border-[#D4A574] transition-all duration-200"

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#F0E6DC] p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4A574] to-[#7B5B3A] flex items-center justify-center shadow-lg shadow-[#D4A574]/20">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-black text-[#3C2415]">Add Payout Method</h3>
                    <p className="text-[9px] font-bold text-[#7B5B3A] uppercase tracking-widest">Choose how you want to receive payouts</p>
                </div>
            </div>

            {/* Method selector */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                {methodOptions.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                            setSelectedMethod(opt.value)
                            resetFields()
                        }}
                        className={`flex flex-col items-center gap-2 px-3 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                            selectedMethod === opt.value
                                ? "bg-[#FAF5F0] text-[#3C2415] border-[#D4A574] shadow-sm"
                                : "bg-white text-[#7B5B3A] border-[#F0E6DC] hover:border-[#D4A574]/50 hover:bg-[#FAF5F0]/50"
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d={opt.icon} />
                        </svg>
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* UPI fields */}
            {selectedMethod === "upi" && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">UPI ID</label>
                        <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="yourname@upi"
                            className={inputClass}
                            required
                        />
                    </div>
                </div>
            )}

            {/* Bank transfer fields */}
            {selectedMethod === "bank_transfer" && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">Account Holder Name</label>
                        <input
                            type="text"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            placeholder="Full name on account"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">Bank Name</label>
                        <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. State Bank of India"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">Account Number</label>
                        <input
                            type="text"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Account number"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">IFSC Code</label>
                        <input
                            type="text"
                            value={ifscCode}
                            onChange={(e) => setIfscCode(e.target.value)}
                            placeholder="e.g. SBIN0001234"
                            className={inputClass}
                            required
                        />
                    </div>
                </div>
            )}

            {/* PayPal fields */}
            {selectedMethod === "paypal" && (
                <div className="space-y-4">
                    <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#7B5B3A] mb-1.5">PayPal Email</label>
                        <input
                            type="email"
                            value={paypalEmail}
                            onChange={(e) => setPaypalEmail(e.target.value)}
                            placeholder="your@email.com"
                            className={inputClass}
                            required
                        />
                    </div>
                </div>
            )}

            {/* Submit */}
            <div className="mt-6">
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-[#D4A574] to-[#7B5B3A] text-white hover:shadow-lg hover:shadow-[#D4A574]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            Adding...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Payout Method
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}

export default PayoutMethodForm
