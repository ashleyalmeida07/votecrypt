"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { RecaptchaVerifier, auth } from "@/lib/firebase"
import { toast } from "sonner"

export default function VerifyPhonePage() {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<any>(null)
  const { user, signInWithPhone } = useAuth()
  const router = useRouter()
  const recaptchaVerifierRef = useRef<any>(null)

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!user && !loading) {
      router.push("/login")
    }

    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear()
          recaptchaVerifierRef.current = null
        } catch (error) {
          console.log('Cleanup error (safe to ignore):', error)
        }
      }
    }
  }, [user, router, loading])

  // Initialize invisible reCAPTCHA on component mount
  useEffect(() => {
    if (!user || recaptchaVerifierRef.current) return

    const initRecaptcha = async () => {
      try {
        const container = document.getElementById('recaptcha-container')
        if (!container) return
        container.innerHTML = ''

        recaptchaVerifierRef.current = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              console.log('reCAPTCHA solved automatically')
            }
          }
        )

        await recaptchaVerifierRef.current.render()
        console.log('Invisible reCAPTCHA initialized')
      } catch (error: any) {
        console.error('Recaptcha initialization error:', error)
        recaptchaVerifierRef.current = null
      }
    }

    initRecaptcha()
  }, [user])

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {

      let formattedPhone = phoneNumber.trim().replace(/\s+/g, '')
      
      // Remove any non-digit characters except +
      formattedPhone = formattedPhone.replace(/[^\d+]/g, '')
      
      // Add +91 if not present
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('91')) {
          formattedPhone = `+${formattedPhone}`
        } else if (formattedPhone.startsWith('0')) {
          // Remove leading 0 if present
          formattedPhone = `+91${formattedPhone.substring(1)}`
        } else {
          formattedPhone = `+91${formattedPhone}`
        }
      }
      
      // Validate phone number format
      const phoneRegex = /^\+91[6-9]\d{9}$/
      if (!phoneRegex.test(formattedPhone)) {
        throw new Error('Please enter a valid 10-digit Indian mobile number starting with 6-9')
      }
      
      console.log('Formatted phone number:', formattedPhone)
      
      if (!recaptchaVerifierRef.current) {
        throw new Error('reCAPTCHA not initialized. Please refresh the page.')
      }
      
      const confirmation = await signInWithPhone(formattedPhone, recaptchaVerifierRef.current)
      setConfirmationResult(confirmation)
      setStep("otp")
      toast.success("OTP sent to your phone!")
    } catch (error: any) {
      console.error("Phone auth error:", error)
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      
      // Check for specific error types
      if (error.code === 'auth/invalid-phone-number') {
        toast.error("Invalid phone number. Please enter a valid Indian mobile number (e.g., +919876543210)")
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Too many requests. Please try again later.")
      } else if (error.code === 'auth/quota-exceeded') {
        toast.error("SMS quota exceeded. Please contact support.")
      } else if (error.code === 'auth/internal-error') {
        toast.error("Firebase configuration error. Please ensure phone authentication is enabled in Firebase Console and this domain is authorized.")
      } else if (error.message?.includes('Phone authentication has not been enabled')) {
        toast.error("Phone authentication is not enabled. Please contact administrator.")
      } else if (error.message?.includes('valid 10-digit')) {
        toast.error(error.message)
      } else {
        toast.error(error.message || "Failed to send OTP. Please try again.")
      }
      
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
      
      // Verify OTP with Firebase
      const result = await confirmationResult.confirm(otp)
      
      // Update database with phone verification
      const response = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: result.user.uid,
          phoneNumber: phoneNumber
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update phone verification')
      }
      
      toast.success("Phone verified successfully! Sign up complete.")
      router.push("/dashboard")
    } catch (error: any) {
      console.error("OTP verification error:", error)
      toast.error(error.message || "Invalid OTP")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null // Will redirect in useEffect
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
          <h1 className="text-3xl font-bold text-white mb-2">Verify Your Phone</h1>
          <p className="text-gray-300">Additional security verification required</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Phone Number</h2>
                <p className="text-gray-600">Enter your phone number for SMS verification</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d+]/g, ''))}
                  placeholder="+919876543210"
                  required
                  maxLength={13}
                  className="ballot-input"
                />
                <p className="text-xs text-gray-500 mt-2">Enter your 10-digit Indian mobile number (e.g., +919876543210 or 9876543210)</p>
              </div>

              <div id="recaptcha-container"></div>

              <button
                type="submit"
                disabled={loading || !phoneNumber}
                className={`w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  loading || !phoneNumber ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Sending OTP..." : "Send OTP"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Verify OTP</h2>
                <p className="text-gray-600">Enter the 6-digit code sent to {phoneNumber}</p>
              </div>

              <div className="mb-6">\
                <label className="block text-sm font-semibold text-slate-900 mb-2">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                {loading ? "Verifying..." : "Verify & Continue"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone")
                  setOtp("")
                }}
                className="w-full mt-4 text-slate-900 hover:text-teal-600 font-semibold transition-colors"
              >
                ← Change phone number
              </button>
            </form>
          )}

          {/* Privacy Notice */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-700">
              <strong>Security Notice:</strong> SMS verification is required to ensure the security of your voting account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
