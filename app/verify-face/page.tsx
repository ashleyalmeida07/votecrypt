"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Shield, Camera, CheckCircle, AlertCircle, Upload, X, RefreshCw, Loader2 } from "lucide-react"

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface VerificationResult {
  verified: boolean
  distance: number | null
  message: string
  id_face_confidence?: number
  selfie_face_confidence?: number
  error?: string
}

export default function VerifyFacePage() {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [status, setStatus] = useState<"idle" | "capturing" | "verifying" | "success" | "failed">("idle")
  const [permission, setPermission] = useState<"pending" | "granted" | "denied">("pending")
  const [idImage, setIdImage] = useState<File | null>(null)
  const [idImagePreview, setIdImagePreview] = useState<string | null>(null)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      // Cleanup camera stream on unmount
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
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

  // Handle ID photo upload
  const handleIdUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage("Please upload an image file")
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage("Image too large (max 10MB)")
        return
      }
      
      setIdImage(file)
      setIdImagePreview(URL.createObjectURL(file))
      setErrorMessage(null)
      setVerificationResult(null)
    }
  }

  // Remove ID photo
  const removeIdImage = () => {
    setIdImage(null)
    if (idImagePreview) {
      URL.revokeObjectURL(idImagePreview)
      setIdImagePreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Capture selfie from webcam
  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    
    setStatus("capturing")
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    if (!context) return
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        setSelfieBlob(blob)
        setSelfiePreview(URL.createObjectURL(blob))
        setStatus("idle")
      }
    }, 'image/jpeg', 0.9)
  }, [])

  // Retake selfie
  const retakeSelfie = () => {
    if (selfiePreview) {
      URL.revokeObjectURL(selfiePreview)
    }
    setSelfieBlob(null)
    setSelfiePreview(null)
    setVerificationResult(null)
    setStatus("idle")
  }

  // Verify faces
  const verifyFace = async () => {
    if (!idImage || !selfieBlob) {
      setErrorMessage("Please upload ID photo and capture selfie first")
      return
    }
    
    setStatus("verifying")
    setErrorMessage(null)
    setVerificationResult(null)
    
    try {
      // Create FormData for multipart upload
      const formData = new FormData()
      formData.append('id_image', idImage)
      formData.append('selfie_image', new File([selfieBlob], 'selfie.jpg', { type: 'image/jpeg' }))
      
      // Send to backend
      const response = await fetch(`${API_BASE_URL}/verify-face`, {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error: ${response.status}`)
      }
      
      const result: VerificationResult = await response.json()
      setVerificationResult(result)
      
      if (result.verified) {
        setStatus("success")
        // Redirect to dashboard after 2 seconds on success
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 2000)
      } else {
        setStatus("failed")
      }
      
    } catch (error) {
      console.error("Verification error:", error)
      setErrorMessage(error instanceof Error ? error.message : "Verification failed. Please try again.")
      setStatus("failed")
    }
  }

  // Reset everything
  const handleReset = () => {
    retakeSelfie()
    removeIdImage()
    setStatus("idle")
    setErrorMessage(null)
    setVerificationResult(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 text-white hover:opacity-80 transition-opacity mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">BALLOT</span>
          </Link>
          <p className="text-gray-300">AI-Powered Face Verification</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Face Verification</h1>
            <p className="text-gray-600">Upload your ID photo and capture a live selfie to verify your identity</p>
          </div>

          {/* Progress Steps */}
          <div className="flex gap-2 mb-8">
            <div className={`flex-1 h-2 rounded-full transition-all ${idImage ? "bg-teal-500" : "bg-gray-200"}`} />
            <div className={`flex-1 h-2 rounded-full transition-all ${selfieBlob ? "bg-teal-500" : "bg-gray-200"}`} />
            <div className={`flex-1 h-2 rounded-full transition-all ${status === "success" ? "bg-teal-500" : "bg-gray-200"}`} />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* ID Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Step 1: Upload ID Photo
              </label>
              {idImagePreview ? (
                <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-[4/3]">
                  <img 
                    src={idImagePreview} 
                    alt="ID Preview" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={removeIdImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                    ✓ ID Uploaded
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500 text-center px-4">
                    Click to upload ID photo
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    JPG, PNG (max 10MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIdUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Selfie Capture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Step 2: Capture Live Selfie
              </label>
              
              {permission === "denied" ? (
                <div className="flex flex-col items-center justify-center w-full aspect-[4/3] bg-gray-100 rounded-xl">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                  <span className="text-sm text-gray-600 text-center px-4">
                    Camera access denied
                  </span>
                  <button
                    onClick={startCamera}
                    className="mt-2 text-sm text-teal-600 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : selfiePreview ? (
                <div className="relative bg-gray-100 rounded-xl overflow-hidden aspect-[4/3]">
                  <img 
                    src={selfiePreview} 
                    alt="Selfie Preview" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={retakeSelfie}
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                    ✓ Selfie Captured
                  </div>
                </div>
              ) : (
                <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-teal-500/50 rounded-full w-32 h-40" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Capture Selfie Button */}
            {!selfiePreview && permission === "granted" && (
              <button
                onClick={captureSelfie}
                disabled={status === "capturing"}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === "capturing" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    Capture Selfie
                  </>
                )}
              </button>
            )}

            {/* Verify Button */}
            {idImage && selfieBlob && status !== "success" && (
              <button
                onClick={verifyFace}
                disabled={status === "verifying"}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === "verifying" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying Face...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Verify Face
                  </>
                )}
              </button>
            )}

            {/* Reset Button */}
            {(status === "failed" || status === "success") && (
              <button
                onClick={handleReset}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
              >
                Start Over
              </button>
            )}
          </div>

          {/* Verification Result */}
          {verificationResult && (
            <div className={`mt-6 p-6 rounded-xl border-2 ${
              verificationResult.verified 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-4">
                {verificationResult.verified ? (
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-500" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${
                    verificationResult.verified ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verificationResult.verified ? '✅ Verified' : '❌ Verification Failed'}
                  </h3>
                  <p className={`text-sm ${
                    verificationResult.verified ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verificationResult.message}
                  </p>
                  {verificationResult.distance !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      Similarity Score: {((1 - verificationResult.distance) * 100).toFixed(1)}% 
                      (Distance: {verificationResult.distance.toFixed(4)})
                    </p>
                  )}
                </div>
              </div>
              
              {verificationResult.verified && (
                <div className="mt-4 text-center text-sm text-green-700">
                  Redirecting to dashboard...
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <h4 className="font-medium text-blue-900 mb-2">Tips for best results:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure good lighting on your face</li>
              <li>• Look directly at the camera</li>
              <li>• Remove glasses or hats if possible</li>
              <li>• Make sure your ID photo is clear and readable</li>
            </ul>
          </div>

          {/* Privacy Notice */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>🔒 Privacy:</strong> Your images are processed securely and immediately deleted after verification. 
              No facial data is stored or shared with third parties.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
