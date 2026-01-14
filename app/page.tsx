"use client"
import Link from "next/link"
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
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="ballot-container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">BALLOT</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-gray-600 hover:text-slate-900 font-medium transition-colors">
              How It Works
            </a>
            <a href="#features" className="text-gray-600 hover:text-slate-900 font-medium transition-colors">
              Features
            </a>
            <a href="#security" className="text-gray-600 hover:text-slate-900 font-medium transition-colors">
              Security
            </a>
            <Link
              href="/login"
              className="text-gray-600 hover:text-slate-900 font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-24 md:py-32">
        <div className="ballot-container">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 rounded-full mb-6 border border-white border-opacity-20">
              <Leaf className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-medium text-gray-200">The Future of Democracy</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-balance">
              Secure. Transparent. Decentralized Voting.
            </h1>
            <p className="text-xl text-gray-300 mb-10 leading-relaxed max-w-2xl">
              Project BALLOT leverages cutting-edge blockchain technology to ensure every vote is cryptographically
              secure, immutable, and verifiable by anyone.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/login"
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 active:scale-95 inline-flex items-center gap-2"
              >
                Cast Your Vote <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="bg-white text-slate-900 hover:bg-gray-100 font-semibold rounded-xl px-8 py-3 transition-all duration-200 inline-flex items-center gap-2"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white border-b border-gray-100 py-12">
        <div className="ballot-container">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { label: "Voters Verified", value: "2.4M+" },
              { label: "Votes Recorded", value: "1.8M+" },
              { label: "Countries", value: "47" },
              { label: "Uptime", value: "99.99%" },
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">{stat.value}</p>
                <p className="text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20">
        <div className="ballot-container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Why Choose BALLOT?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Enterprise-grade security with government-level transparency and privacy.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                icon: Shield,
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
                icon: BarChart3,
                title: "Audit Trail Logging",
                desc: "Complete blockchain history for all transactions",
              },
              {
                icon: CheckCircle,
                title: "Decentralized Verification",
                desc: "Independent node verification of all votes",
              },
            ].map((feature, idx) => (
              <div key={idx} className="ballot-card ballot-card-hover p-8">
                <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white border-y border-gray-100 py-20">
        <div className="ballot-container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Four simple steps to secure voting</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                title: "Secure Authentication",
                desc: "Verify identity with National ID and OTP",
              },
              {
                step: "2",
                title: "Biometric Verification",
                desc: "AI face verification ensures authenticity",
              },
              {
                step: "3",
                title: "Blockchain Recording",
                desc: "Vote encrypted and stored immutably",
              },
              {
                step: "4",
                title: "Transparent Results",
                desc: "Results publicly verified on blockchain",
              },
            ].map((item, idx) => (
              <div key={idx} className="relative">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[40%] h-0.5 bg-gradient-to-r from-teal-500 to-transparent"></div>
                )}
                <div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4 bg-slate-900 text-white relative z-10">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-20">
        <div className="ballot-container">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Security & Trust</h2>
            <p className="text-xl text-gray-600">Industry-leading protection for democratic participation</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
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
              <div key={idx} className="ballot-card ballot-card-hover p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center">
                    <item.icon className="w-8 h-8 text-teal-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-16">
        <div className="ballot-container text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Vote?</h2>
          <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Join millions of voters participating in the future of democratic participation with absolute security and
            transparency.
          </p>
          <Link
            href="/login"
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl px-8 py-3 transition-all duration-200 active:scale-95 inline-flex items-center gap-2"
          >
            Cast Your Vote Now <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-300 py-12 border-t border-gray-800">
        <div className="ballot-container">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-white">BALLOT</span>
              </div>
              <p className="text-sm text-gray-400">Secure blockchain voting for transparent democracy.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#security" className="text-gray-400 hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">
                    API Docs
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Connect</h4>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="#"
                  className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Project BALLOT. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
