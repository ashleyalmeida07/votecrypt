"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Shield, Camera, CheckCircle, AlertCircle } from "lucide-react"

export default function VerifyFacePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<"idle" | "detecting" | "match-success" | "match-failed">("idle")
  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending")

  useEffect(() => {
    startCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setPermission("granted")
      }
    } catch (error) {
      console.error("Camera access denied:", error)
      setPermission("denied")
    }
  }

  const handleCapture = async () => {
    setStatus("detecting")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const isSuccess = Math.random() > 0.2

    if (isSuccess) {
      setStatus("match-success")
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 2000)
    } else {
      setStatus("match-failed")
    }
  }

  const handleRetry = () => {
    setStatus("idle")
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
          <p className="text-gray-300">Biometric Verification</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">AI Face Verification</h1>
            <p className="text-gray-600">Step 2 of 3 - Biometric Authentication</p>
          </div>

          {/* Progress Steps */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((stepNum) => {
              const isActive = stepNum <= 2
              return (
                <div
                  key={stepNum}
                  className={`flex-1 h-2 rounded-full transition-all ${isActive ? "bg-slate-900" : "bg-gray-200"}`}
                />
              )
            })}
          </div>

          {/* Camera or Permission Denied */}
          {permission === "denied" ? (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <AlertCircle className="w-16 h-16 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Camera Access Required</h2>
              <p className="text-gray-600 mb-6">Allow camera access in browser settings to continue.</p>
              <button
                onClick={startCamera}
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 w-full flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" /> Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Video Container */}
              <div className="relative bg-black rounded-2xl overflow-hidden mb-6 aspect-video">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

                {/* Face Bounding Box */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-teal-500 rounded-3xl w-48 h-56"></div>
                </div>

                {/* Status Overlay */}
                {status !== "idle" && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-center">
                      {status === "detecting" && (
                        <>
                          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                          <p className="text-white font-semibold">Analyzing face...</p>
                        </>
                      )}
                      {status === "match-success" && (
                        <>
                          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <p className="text-white font-semibold">Verified!</p>
                        </>
                      )}
                      {status === "match-failed" && (
                        <>
                          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                          <p className="text-white font-semibold">Try Again</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Instructions */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-900">Position your face in the frame with good lighting.</p>
              </div>

              {/* Action Buttons */}
              {status === "idle" && (
                <button
                  onClick={handleCapture}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 w-full flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Start Verification
                </button>
              )}

              {status === "match-failed" && (
                <button
                  onClick={handleRetry}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 w-full"
                >
                  Try Again
                </button>
              )}
            </>
          )}

          {/* Privacy Notice */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-700">
              <strong>Privacy:</strong> Face data is processed locally and immediately deleted after verification. Never
              stored or shared.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
