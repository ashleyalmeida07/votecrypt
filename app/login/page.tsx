"use client"
import { useState, useEffect, useRef } from "react"
import type React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { RecaptchaVerifier, auth } from "@/lib/firebase"
import { toast } from "sonner"

export default function LoginPage() {
  const [step, setStep] = useState<"method" | "phone" | "otp">("method")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<any>(null)
  const { signInWithGoogle, signInWithPhone } = useAuth()
  const router = useRouter()
  const recaptchaContainerRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      try {
        if (recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current.clear()
        }
      } catch (error) {
        // Ignore cleanup errors
        console.log('Cleanup error (safe to ignore):', error)
      }
    }
  }, [])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
      toast.success("Successfully signed in!")
      router.push("/verify-phone")
    } catch (error: any) {
      console.error("Sign in error:", error)
      toast.error(error.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Clear any existing recaptcha
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear()
        } catch (e) {
          // Ignore clear errors
        }
        recaptchaVerifierRef.current = null
      }

      // Create new recaptcha verifier
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        'recaptcha-container',
        {
          size: 'normal',
          callback: () => {
            console.log('reCAPTCHA solved')
          },
          'expired-callback': () => {
            toast.error('reCAPTCHA expired. Please try again.')
          }
        },
        auth
      )
      
      try {
        await recaptchaVerifierRef.current.render()
      } catch (error: any) {
        console.error('Recaptcha render error:', error)
        throw new Error('Failed to initialize verification. Please refresh the page.')
      }

      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`
      const confirmation = await signInWithPhone(formattedPhone, recaptchaVerifierRef.current)
      setConfirmationResult(confirmation)
      setStep("otp")
      toast.success("OTP sent to your phone!")
    } catch (error: any) {
      console.error("Phone auth error:", error)
      
      if (error.code === 'auth/invalid-phone-number') {
        toast.error("Invalid phone number. Please include country code (e.g., +1234567890)")
      } else if (error.code === 'auth/too-many-requests') {
        toast.error("Too many requests. Please try again later.")
      } else if (error.message?.includes('Phone authentication has not been enabled')) {
        toast.error("Phone authentication is not enabled. Please enable it in Firebase Console.")
      } else {
        toast.error(error.message || "Failed to send OTP. Please try again.")
      }
      
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear()
        } catch (e) {
          // Ignore cleanup errors
        }
        recaptchaVerifierRef.current = null
      }
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
      
      await confirmationResult.confirm(otp)
      toast.success("Successfully signed in!")
      router.push("/dashboard")
    } catch (error: any) {
      console.error("OTP verification error:", error)
      toast.error(error.message || "Invalid OTP")
    } finally {
      setLoading(false)
    }
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
          {step === "method" && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Sign In</h2>
                <p className="text-gray-600">Two-factor authentication required</p>
              </div>

              <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-900">
                  <strong>🔒 2-Step Verification:</strong> Sign in with Google, then verify your phone number
                </p>
              </div>

              {/* Google Sign In Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-50 border-2 border-gray-200 text-slate-900 font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-3 mb-6"
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-600">
                Don't have an account?{" "}
                <Link href="/signup" className="text-teal-600 hover:text-teal-700 font-semibold">
                  Sign up here
                </Link>
              </p>
            </>
          )}

          {step === "phone" && (
            <form onSubmit={handlePhoneSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Phone Number</h2>
                <p className="text-gray-600">Enter your phone number with country code</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  required
                  className="ballot-input"
                />
                <p className="text-xs text-gray-500 mt-2">Include country code (e.g., +1 for US, +91 for India)</p>
              </div>

              <div ref={recaptchaContainerRef} id="recaptcha-container"></div>

              <button
                type="submit"
                disabled={loading || !phoneNumber}
                className={`w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 ${
                  loading || !phoneNumber ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Sending OTP..." : "Send OTP"} {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setStep("method")}
                className="w-full mt-4 text-slate-900 hover:text-teal-600 font-semibold transition-colors"
              >
                ← Back to sign in options
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit}>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Verify OTP</h2>
                <p className="text-gray-600">Enter the 6-digit code sent to {phoneNumber}</p>
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
              <strong>Privacy Policy:</strong> Your personal data is encrypted with AES-256. It is never shared or
              stored after verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
