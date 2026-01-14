"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

export default function VerifyPhonePage() {
  const [step, setStep] = useState<"otp">("otp")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<any>(null)
  const { user } = useAuth()
  const router = useRouter()
  const otpSentRef = useRef(false)

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!user) {
      router.push("/login")
      return
    }

    // Automatically send OTP to user's Google email when component loads (only once)
    if (user?.email && !otpSentRef.current && !loading && !confirmationResult) {
      otpSentRef.current = true
      sendOtpToEmail(user.email)
    }
  }, [user])

  const sendOtpToEmail = async (emailAddress: string) => {
    setLoading(true)

    try {
      // Call API to send OTP
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP')
      }

      setConfirmationResult(data)
      toast.success("Verification code sent to your email")
      
      // Show dev OTP in development (console only)
      if (data.devOtp && process.env.NODE_ENV === 'development') {
        console.log('Dev OTP:', data.devOtp)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code")
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!confirmationResult) {
        throw new Error("No confirmation result")
      }
      
      // Verify OTP via API
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user?.email,
          otp,
          sessionId: confirmationResult.sessionId,
          firebaseUid: user?.uid
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP')
      }
      
      toast.success("Email verified successfully!")
      
      // Redirect to dashboard immediately
      router.push("/dashboard")
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-3 text-white hover:opacity-80 transition-opacity mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">BALLOT</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Verify Your Email</h1>
          <p className="text-gray-300">Additional security verification required</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          {loading && !confirmationResult ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
              <p className="text-slate-900 font-semibold">Sending OTP to {user?.email}...</p>
            </div>
          ) : (
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Verify OTP</h2>
                <p className="text-gray-600">Enter the 6-digit code sent to {user?.email}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  className="ballot-input text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className={`w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  loading || otp.length !== 6 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Verifying..." : "Verify & Continue"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  otpSentRef.current = false
                  sendOtpToEmail(user?.email || '')
                }}
                disabled={loading}
                className="w-full mt-4 text-slate-900 hover:text-teal-600 font-semibold transition-colors disabled:opacity-50"
              >
                Resend OTP
              </button>
            </form>
          )}

          {/* Privacy Notice */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-700">
              <strong>Security Notice:</strong> Email verification is required to ensure the security of your voting account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
