"use client"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import {
  Shield,
  Eye,
  Zap,
  CheckCircle,
  Lock,
  BarChart3,
  Github,
  Mail,
  ArrowRight,
  Leaf,
  Users,
  Clock,
  Moon,
  Sun,
  Menu,
  X,
  Fingerprint,
  Database,
  Award,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="w-full max-w-350 mx-auto flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="h-8 w-8" />
            <span className="text-xl md:text-2xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent whitespace-nowrap">
              VoteCrypt
            </span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#security" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Security
            </a>
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Login
            </Link>
            <Link href="/signup">
              <Button className="rounded-full px-4 lg:px-6">
                Sign Up
                <ArrowRight className="ml-2 h-4 w-4" />
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

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-full"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background p-4 space-y-3">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium hover:text-primary transition-colors py-2"
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium hover:text-primary transition-colors py-2"
            >
              How It Works
            </a>
            <a 
              href="#security" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium hover:text-primary transition-colors py-2"
            >
              Security
            </a>
            <Link 
              href="/login" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium hover:text-primary transition-colors py-2"
            >
              Login
            </Link>
            <Link href="/signup" className="block">
              <Button className="w-full rounded-full">Sign Up</Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 lg:py-32 w-full">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-primary/10 to-transparent dark:from-primary/10 dark:via-primary/5" />
        <div className="w-full max-w-350 mx-auto relative px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium inline-flex items-center">
              <Sparkles className="mr-2 h-4 w-4" />
              The Future of Democracy
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
              Secure. Transparent. Decentralized Voting.
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto px-4">
              VoteCrypt leverages cutting-edge blockchain technology and zero-knowledge proofs to ensure every vote is cryptographically secure, immutable, and verifiable by anyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/login">
                <Button size="lg" className="rounded-full px-8 w-full sm:w-auto">
                  Cast Your Vote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="rounded-full px-8 w-full sm:w-auto">
                  Learn More
                </Button>
              </a>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-1/4 left-0 md:left-10 w-48 md:w-72 h-48 md:h-72 bg-primary/20 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 md:right-10 w-64 md:w-96 h-64 md:h-96 bg-primary/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/50 py-12 md:py-16 w-full">
        <div className="w-full max-w-350 mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: "Voters Verified", value: "2.4M+", icon: Users },
              { label: "Votes Recorded", value: "1.8M+", icon: CheckCircle },
              { label: "Countries", value: "47", icon: Leaf },
              { label: "Uptime", value: "99.99%", icon: Award },
            ].map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center text-center space-y-2">
                <stat.icon className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />
                <p className="text-2xl md:text-3xl lg:text-4xl font-bold">{stat.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 md:py-20 w-full">
        <div className="w-full max-w-350 mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="mb-2">Features</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">Why Choose VoteCrypt?</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Enterprise-grade security with government-level transparency and privacy.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
              {
                icon: Lock,
                title: "Blockchain-Backed Votes",
                desc: "Cryptographically secured and immutable on distributed ledger",
              },
              {
                icon: Eye,
                title: "Anonymous yet Verifiable",
                desc: "Private votes with transparent election verification",
              },
              {
                icon: Zap,
                title: "Smart Contract Counting",
                desc: "Automated vote tallying eliminates human error",
              },
              {
                icon: Fingerprint,
                title: "AI-Powered Verification",
                desc: "Advanced biometric authentication prevents fraud",
              },
              {
                icon: Users,
                title: "Multi-Language Support",
                desc: "Accessible voting interface for all populations",
              },
              {
                icon: Clock,
                title: "Real-Time Transparency",
                desc: "Live results dashboard with instant verification",
              },
              {
                icon: Database,
                title: "Audit Trail Logging",
                desc: "Complete blockchain history for all transactions",
              },
              {
                icon: CheckCircle,
                title: "Decentralized Verification",
                desc: "Independent node verification of all votes",
              },
            ].map((feature, idx) => (
              <Card key={idx} className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader className="space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-base md:text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{feature.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y bg-muted/30 py-16 md:py-20 w-full">
        <div className="w-full max-w-350 mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="mb-2">Process</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">How It Works</h2>
            <p className="text-lg md:text-xl text-muted-foreground px-4">Four simple steps to secure voting</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              {
                step: "1",
                title: "Secure Authentication",
                desc: "Verify identity with National ID and OTP",
                icon: Shield,
              },
              {
                step: "2",
                title: "Biometric Verification",
                desc: "AI face verification ensures authenticity",
                icon: Fingerprint,
              },
              {
                step: "3",
                title: "Blockchain Recording",
                desc: "Vote encrypted and stored immutably",
                icon: Database,
              },
              {
                step: "4",
                title: "Transparent Results",
                desc: "Results publicly verified on blockchain",
                icon: BarChart3,
              },
            ].map((item, idx) => (
              <div key={idx} className="relative">
                {idx < 3 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-linear-to-r from-primary to-transparent z-0" />
                )}
                <Card className="relative z-10 text-center h-full">
                  <CardHeader className="space-y-3">
                    <div className="mx-auto flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl md:text-2xl font-bold">
                      {item.step}
                    </div>
                    <item.icon className="h-6 w-6 md:h-8 md:w-8 mx-auto text-primary" />
                    <CardTitle className="text-base md:text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{item.desc}</CardDescription>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-16 md:py-20 w-full">
        <div className="w-full max-w-350 mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <Badge variant="outline" className="mb-2">Security</Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">Security & Trust</h2>
            <p className="text-lg md:text-xl text-muted-foreground px-4">Industry-leading protection for democratic participation</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: Lock,
                title: "Cryptographic Security",
                desc: "Military-grade encryption (AES-256) protects every vote from interception",
              },
              {
                icon: BarChart3,
                title: "Immutable Records",
                desc: "Blockchain ensures no vote can ever be altered, deleted, or forged",
              },
              {
                icon: CheckCircle,
                title: "Decentralized Verification",
                desc: "Thousands of independent nodes verify all transactions in real-time",
              },
            ].map((item, idx) => (
              <Card key={idx} className="text-center border-2 hover:border-primary/50 transition-all hover:shadow-xl h-full">
                <CardHeader className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <item.icon className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground py-16 md:py-20 w-full">
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/90 to-primary/80" />
        <div className="w-full max-w-350 mx-auto relative text-center px-4 md:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">Ready to Vote?</h2>
          <p className="text-lg md:text-xl opacity-90 mb-6 md:mb-8 max-w-2xl mx-auto px-4">
            Join millions of voters participating in the future of democratic participation with absolute security and transparency.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="rounded-full px-8">
              Cast Your Vote Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 md:w-80 h-64 md:h-80 bg-white/10 rounded-full blur-3xl" />
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50 py-12 w-full">
        <div className="w-full max-w-350 mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/favicon.svg" alt="VoteCrypt Logo" className="h-8 w-8" />
                <span className="font-bold text-lg">VoteCrypt</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Secure blockchain voting for transparent democracy powered by zero-knowledge proofs.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" size="icon" className="rounded-full">
                  <Github className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#security" className="text-muted-foreground hover:text-primary transition-colors">
                    Security
                  </a>
                </li>
                <li>
                  <Link href="/results" className="text-muted-foreground hover:text-primary transition-colors">
                    Results
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <Link href="/audit" className="text-muted-foreground hover:text-primary transition-colors">
                    Audit System
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} VoteCrypt. All rights reserved. Built with blockchain technology.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
