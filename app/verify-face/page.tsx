"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, Camera, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import Webcam from "react-webcam"

export default function VerifyFacePage() {
  const [capturing, setCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle')
  const [verificationDetails, setVerificationDetails] = useState<any>(null)
  const webcamRef = useRef<Webcam>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  const captureImage = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot()
      if (imageSrc) {
        setCapturedImage(imageSrc)
        setCapturing(false)
      }
    }
  }, [])

  const retakePhoto = () => {
    setCapturedImage(null)
    setVerificationStatus('idle')
    setVerificationDetails(null)
  }

  const verifyFace = async () => {
    if (!capturedImage || !user) return

    try {
      setVerifying(true)
      setVerificationStatus('idle')
      setVerificationDetails(null)

      const response = await fetch('/api/face/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: user.uid,
          selfieImage: capturedImage
        })
      })

      const data = await response.json()

      if (response.ok && data.verified) {
        setVerificationStatus('success')
        setVerificationDetails(data)
        toast.success(`Face verified! ${data.similarity_percentage}% match`)
        
        // Redirect to dashboard after successful verification
        setTimeout(() => {
          router.push('/dashboard')
        }, 2500)
      } else {
        setVerificationStatus('failed')
        setVerificationDetails(data)
        const errorMsg = data.message || "Face verification failed. Please try again."
        toast.error(errorMsg)
      }
    } catch (error: any) {
      console.error("Verification error:", error)
      setVerificationStatus('failed')
      toast.error("Failed to verify face")
    } finally {
      setVerifying(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 text-white hover:opacity-80 transition-opacity mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">BALLOT</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Face Verification</h1>
          <p className="text-gray-300">Verify your identity to access the voting portal</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          {/* Info Alert */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-900">
              <strong>🎥 Live Verification:</strong> Position your face in the camera frame. We'll compare it with your voter ID photo.
            </p>
          </div>

          {/* Camera View or Captured Image */}
          <div className="mb-6">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              {!capturedImage ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  mirrored={true}
                  onUserMedia={() => setCapturing(true)}
                  onUserMediaError={(err) => {
                    console.error('Webcam error:', err)
                    toast.error("Failed to access camera. Please allow camera permissions.")
                  }}
                />
              ) : (
                <img 
                  src={capturedImage} 
                  alt="Captured" 
                  className="w-full h-full object-cover"
                />
              )}

              {/* Overlay guide */}
              {!capturedImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-80 border-4 border-teal-500 rounded-3xl opacity-50"></div>
                </div>
              )}
            </div>
          </div>

          {/* Verification Status */}
          {verificationStatus !== 'idle' && (
            <div className={`mb-6 p-4 rounded-xl border ${
              verificationStatus === 'success' 
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-center gap-3">
                {verificationStatus === 'success' ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <div>
                      <p className="font-semibold">Verification Successful!</p>
                      {verificationDetails?.similarity_percentage && (
                        <p className="text-sm mt-1">Match: {verificationDetails.similarity_percentage}%</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <p className="font-semibold">Verification Failed</p>
                      {verificationDetails?.similarity_percentage && (
                        <p className="text-sm mt-1">Match: {verificationDetails.similarity_percentage}%</p>
                      )}
                    </div>
                  </>
                )}
              </div>
              {verificationStatus === 'failed' && (
                <p className="text-sm mt-2 ml-8">
                  {verificationDetails?.message || "The face doesn't match your voter ID. Please ensure good lighting and try again."}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!capturedImage ? (
              <button
                onClick={captureImage}
                disabled={!capturing || verifying}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </button>
            ) : (
              <>
                <button
                  onClick={retakePhoto}
                  disabled={verifying || verificationStatus === 'success'}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-slate-900 font-semibold rounded-xl px-6 py-3 transition-all duration-200 disabled:opacity-50"
                >
                  Retake
                </button>
                <button
                  onClick={verifyFace}
                  disabled={verifying || verificationStatus === 'success'}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : verificationStatus === 'success' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </>
                  ) : (
                    'Verify Face'
                  )}
                </button>
              </>
            )}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="font-semibold text-slate-900 mb-3">Tips for best results:</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">✓</span>
                <span>Ensure good lighting on your face</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">✓</span>
                <span>Look directly at the camera</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">✓</span>
                <span>Remove sunglasses or face coverings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">✓</span>
                <span>Keep your face within the guide frame</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            🔒 Face verification ensures only you can access your voting account
          </p>
        </div>
      </div>
    </div>
  )
}
