"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, Upload, CheckCircle, AlertCircle, Loader2, FileText } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

export default function UploadVoterIdPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [verificationDetails, setVerificationDetails] = useState<any>(null)
  const { user } = useAuth()
  const router = useRouter()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type (image only)
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Please upload an image file (JPG or PNG)")
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB")
        return
      }

      setFile(selectedFile)
      setVerificationStatus('idle')
      setVerificationDetails(null)
    }
  }

  const handleUpload = async () => {
    if (!file || !user) return

    try {
      setUploading(true)
      setVerifying(true)
      setVerificationStatus('processing')

      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('firebaseUid', user.uid)

      // Upload and verify
      const response = await fetch('/api/voter-id/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setVerificationStatus('success')
        setVerificationDetails(data.verification)
        toast.success("Account created successfully! Please login to continue.")
        
        // Redirect to login after 2.5 seconds
        setTimeout(() => {
          router.push('/login')
        }, 2500)
      } else {
        setVerificationStatus('error')
        setVerificationDetails(data.verification)
        toast.error(data.error || "Verification failed. Please check your document.")
      }
    } catch (error: any) {
      console.error("Upload error:", error)
      setVerificationStatus('error')
      toast.error("Failed to upload voter ID")
    } finally {
      setUploading(false)
      setVerifying(false)
    }
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 text-white hover:opacity-80 transition-opacity mb-6">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold">VoteCrypt</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Upload Voter ID</h1>
          <p className="text-gray-300">Verify your identity to complete registration</p>
        </div>

        {/* Card */}
        <div className="ballot-card p-8">
          {/* Info Alert */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-900">
              <strong>📋 Required:</strong> Upload a clear photo (JPG/PNG) of your Indian Voter ID card. If you have a PDF, please convert it to an image first.
            </p>
          </div>

          {/* Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Voter ID Document
            </label>
            
            {!file ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="mb-2 text-sm text-gray-700">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">JPG, PNG (MAX. 10MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                />
              </label>
            ) : (
              <div className="border-2 border-gray-300 rounded-xl p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-teal-500" />
                    <div>
                      <p className="font-semibold text-slate-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-700 text-sm font-semibold"
                  >
                    Remove
                  </button>
                </div>

                {/* Verification Status */}
                {verificationStatus !== 'idle' && (
                  <div className="mt-4 p-4 rounded-lg border">
                    {verificationStatus === 'processing' && (
                      <div className="flex items-center gap-3 text-blue-700">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <div>
                          <p className="font-semibold">Running OCR verification...</p>
                          <p className="text-sm text-gray-600">
                            Please wait while we verify your document
                          </p>
                        </div>
                      </div>
                    )}

                    {verificationStatus === 'success' && verificationDetails && (
                      <div className="text-green-700">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle className="w-5 h-5" />
                          <p className="font-semibold">Verification Successful!</p>
                        </div>
                        <div className="text-sm space-y-1 ml-8">
                          <p>✓ Election Commission of India: {verificationDetails.hasECI ? 'Found' : 'Not Found'}</p>
                          <p>✓ Name field: {verificationDetails.hasName ? 'Found' : 'Not Found'}</p>
                          <p>✓ Gender field: {verificationDetails.hasGender ? 'Found' : 'Not Found'}</p>
                          <p>✓ Date of Birth field: {verificationDetails.hasDOB ? 'Found' : 'Not Found'}</p>
                        </div>
                      </div>
                    )}

                    {verificationStatus === 'error' && (
                      <div className="text-red-700">
                        <div className="flex items-center gap-3 mb-2">
                          <AlertCircle className="w-5 h-5" />
                          <p className="font-semibold">Verification Failed</p>
                        </div>
                        <p className="text-sm ml-8">The document could not be verified as a valid Indian Voter ID card. Please ensure the image is clear and contains all required information.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={handleUpload}
              disabled={!file || uploading || verificationStatus === 'success'}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
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
                'Upload & Verify'
              )}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            🔒 Your document is encrypted and stored securely in Firebase Storage
          </p>
        </div>
      </div>
    </div>
  )
}
