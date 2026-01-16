"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Shield, ArrowRight, Lock, Moon, Sun } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { signInWithGoogle, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      
      if (!result?.user?.uid) {
        throw new Error("Failed to authenticate with Google")
      }
      
      // Check if user exists in database
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebaseUid: result.user.uid,
          email: result.user.email
        })
      })
      
      const data = await response.json()
      
      if (!data.exists) {
        // User not in database - sign them out and redirect
        await signOut()
        toast.error("Account not found. Please sign up first.")
        setTimeout(() => router.push("/signup"), 1500)
        return
      }
      
      toast.success("Successfully signed in!")
      router.push("/verify-phone")
    } catch (error: any) {
      console.error("Sign in error:", error)
      toast.error(error.message || "Failed to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="w-full max-w-350 mx-auto flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="h-8 w-8" />
            <span className="text-xl md:text-2xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
              VoteCrypt
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link href="/signup">
              <Button variant="outline" size="sm">
                Sign Up
              </Button>
            </Link>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-center p-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 space-y-2">
          <Link href="/" className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity mb-4">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold">VoteCrypt</span>
          </Link>
          <p className="text-muted-foreground">Secure Democratic Voting</p>
        </div>

        {/* Card */}
        <Card className="border-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Sign in with your Google account to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                <strong>2-Step Verification:</strong> Sign in with Google, then verify your email
              </AlertDescription>
            </Alert>

            {/* Google Sign In Button */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="outline"
              size="lg"
              className="w-full h-12"
            >
              {loading ? (
                "Signing in..."
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-semibold">
                Sign up here
              </Link>
            </p>

            {/* Privacy Notice */}
            <Alert variant="default" className="bg-muted">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Security Notice:</strong> Your voting account is protected by Google authentication and email verification.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
