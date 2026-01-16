"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, Camera, CheckCircle, AlertCircle, Loader2, RefreshCcw, Video } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import Webcam from "react-webcam"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export default function VerifyFacePage() {
  const [capturing, setCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'failed'>('idle')
  const [verificationDetails, setVerificationDetails] = useState<any>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const webcamRef = useRef<Webcam>(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  // Fetch available video devices
  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput")
      setDevices(videoDevices)

      // Default to first device or user preference if needed
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }
    },
    [selectedDeviceId]
  );

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

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

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(event.target.value)
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity mb-6">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold">VoteCrypt</span>
          </Link>
        </div>

        {/* Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Video className="h-6 w-6" />
              Face Verification
            </CardTitle>
            <CardDescription>
              Verify your identity to access the voting portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Alert */}
            <Alert>
              <Camera className="h-4 w-4" />
              <AlertDescription>
                <strong>Live Verification:</strong> Position your face in the camera frame. We'll compare it with your voter ID photo.
              </AlertDescription>
            </Alert>

            {/* Camera View or Captured Image */}
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border-2">
              {!capturedImage ? (
                <>
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    mirrored={devices.find(d => d.deviceId === selectedDeviceId)?.label?.toLowerCase().includes('front') || false}
                    videoConstraints={selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: 'user' }}
                    onUserMedia={() => setCapturing(true)}
                    onUserMediaError={(err) => {
                      console.error('Webcam error:', err)
                      toast.error("Failed to access camera. Please allow camera permissions.")
                    }}
                  />

                  {/* Camera Selection Dropdown */}
                  {devices.length > 1 && (
                    <div className="absolute top-4 right-4 z-20">
                      <select
                        value={selectedDeviceId || ''}
                        onChange={handleDeviceChange}
                        className="bg-black/60 text-white text-sm rounded-lg px-3 py-2 border border-white/20 backdrop-blur-sm outline-none focus:border-primary cursor-pointer"
                      >
                        {devices.map((device, key) => (
                          <option key={key} value={device.deviceId} className="bg-background text-foreground">
                            {device.label || `Camera ${key + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Overlay guide */}
              {!capturedImage && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-64 h-80 border-4 border-primary rounded-3xl opacity-50"></div>
                </div>
              )}
            </div>

            {/* Verification Status */}
            {verificationStatus !== 'idle' && (
              <Alert variant={verificationStatus === 'success' ? 'default' : 'destructive'}>
                {verificationStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <p className="font-semibold">
                    {verificationStatus === 'success' ? 'Verification Successful!' : 'Verification Failed'}
                  </p>
                  {verificationDetails?.similarity_percentage && (
                    <p className="text-sm mt-1">Match: {verificationDetails.similarity_percentage}%</p>
                  )}
                  {verificationStatus === 'failed' && (
                    <p className="text-sm mt-2">
                      {verificationDetails?.message || "The face doesn't match your voter ID. Please ensure good lighting and try again."}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {!capturedImage ? (
                <Button
                  onClick={captureImage}
                  disabled={!capturing || verifying}
                  size="lg"
                  className="w-full"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Capture Photo
                </Button>
              ) : (
                <>
                  <Button
                    onClick={retakePhoto}
                    disabled={verifying || verificationStatus === 'success'}
                    variant="outline"
                    size="lg"
                    className="flex-1"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={verifyFace}
                    disabled={verifying || verificationStatus === 'success'}
                    size="lg"
                    className="flex-1"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : verificationStatus === 'success' ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verified
                      </>
                    ) : (
                      'Verify Face'
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Tips */}
            <Card className="border">
              <CardContent className="pt-6">
                <p className="font-semibold mb-3">Tips for best results:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Ensure good lighting on your face</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Look directly at the camera</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Remove sunglasses or face coverings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Keep your face within the guide frame</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Face verification ensures only you can access your voting account</span>
          </div>
        </div>
      </div>
    </div>
  )
}