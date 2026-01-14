"use client"
import { useState } from "react"
import type React from "react"

import Link from "next/link"
import { Shield, ArrowRight, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const [step, setStep] = useState<"login" | "otp">("login")
  const [voterId, setVoterId] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)

  const handleVoterIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setStep("otp")
    setLoading(false)
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    window.location.href = "/verify-face"
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-3 text-white hover:opacity-80 transition-opacity mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">BALLOT</span>
          </Link>
          <p className="text-gray-300">Secure Democratic Voting</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Secure Authentication</h1>
            <p className="text-gray-600">Step {step === "login" ? "1" : "2"} of 3 - Verify Your Identity</p>
          </div>

          {/* Progress Steps */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((stepNum) => {
              const stepNames: ("login" | "otp" | "face")[] = ["login", "otp", "face"]
              const isActive = stepNames.indexOf(step as any) >= stepNum - 1
              return (
                <div
                  key={stepNum}
                  className={`flex-1 h-2 rounded-full transition-all ${isActive ? "bg-slate-900" : "bg-gray-200"}`}
                />
              )
            })}
          </div>

          {/* Login Step */}
          {step === "login" && (
            <form onSubmit={handleVoterIdSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Voter ID / National ID</label>
                <input
                  type="text"
                  value={voterId}
                  onChange={(e) => setVoterId(e.target.value)}
                  placeholder="Enter your 12-digit ID"
                  required
                  className="ballot-input"
                />
                <p className="text-xs text-gray-500 mt-2">Your ID is encrypted and never shared with third parties.</p>
              </div>

              <button
                type="submit"
                disabled={loading || !voterId}
                className={`w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  loading || !voterId ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Verifying..." : "Send OTP"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-center text-sm text-gray-600 mt-6">
                Don't have a Voter ID?{" "}
                <a href="#" className="text-teal-600 hover:text-teal-700 font-semibold">
                  Register here
                </a>
              </p>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-4 p-4 bg-teal-50 rounded-xl border border-teal-100">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-teal-900">OTP sent to your registered mobile number</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="ballot-input text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className={`w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  loading || otp.length !== 6 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Verifying..." : "Verify OTP"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setStep("login")}
                className="w-full mt-4 text-slate-900 hover:text-teal-600 font-semibold transition-colors"
              >
                ← Change Voter ID
              </button>
            </form>
          )}

          {/* Privacy Notice */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-700">
              <strong>Privacy Policy:</strong> Your personal data is encrypted with AES-256. It is never shared or
              stored after verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
