"use client"
import { useState } from "react"
import { CheckCircle, Clock, LogOut, ChevronRight, AlertTriangle } from "lucide-react"

export default function VoterDashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)

  const candidates = [
    { id: "1", name: "Alice Johnson", party: "Democratic Party", bio: "Education and climate advocate" },
    { id: "2", name: "Robert Chen", party: "Republican Party", bio: "Economic and trade specialist" },
    { id: "3", name: "Maria Garcia", party: "Independent", bio: "Healthcare and social reform" },
  ]

  const handleVoteSubmit = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setHasVoted(true)
    setShowConfirmation(false)
  }

  if (hasVoted) {
    return <VoteConfirmationScreen />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="ballot-container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">BALLOT Dashboard</h1>
          <button className="text-gray-600 hover:text-slate-900 flex items-center gap-2 font-medium transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="ballot-container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Voter Status */}
            <div className="ballot-card ballot-card-hover p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-2">Voter Status</h2>
                  <p className="text-gray-600">Your identity has been verified</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            {/* Election Info */}
            <div className="ballot-card ballot-card-hover p-6 mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Presidential Election 2025</h2>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Election Date</p>
                  <p className="font-semibold text-slate-900">March 15, 2025</p>
                </div>
                <div>
                  <p className="text-gray-600">Voting Status</p>
                  <p className="font-semibold text-slate-900">Active</p>
                </div>
              </div>
            </div>

            {/* Candidates */}
            <div className="ballot-card ballot-card-hover p-6 mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Select Your Candidate</h2>

              <div className="space-y-4">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedCandidate === candidate.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 hover:border-slate-900"
                    }`}
                    onClick={() => setSelectedCandidate(candidate.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-1">{candidate.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{candidate.party}</p>
                        <p className="text-sm text-gray-500">{candidate.bio}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 ${
                          selectedCandidate === candidate.id ? "border-teal-500 bg-teal-500" : "border-gray-300"
                        }`}
                      >
                        {selectedCandidate === candidate.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cast Vote Button */}
              <div className="mt-8">
                <button
                  onClick={() => setShowConfirmation(true)}
                  disabled={!selectedCandidate}
                  className={`w-full ballot-primary-btn flex items-center justify-center gap-2 ${
                    !selectedCandidate ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Cast Vote Securely
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* Important Notice */}
            <div className="ballot-card ballot-card-hover p-6 mb-6 border-l-4 border-amber-500">
              <div className="flex gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <h3 className="font-bold text-slate-900">Important Notice</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex gap-2">
                  <span className="text-teal-500">•</span>
                  <span>Votes cannot be changed once submitted</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-teal-500">•</span>
                  <span>Your vote remains anonymous and encrypted</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-teal-500">•</span>
                  <span>You can verify your vote on the blockchain</span>
                </li>
              </ul>
            </div>

            {/* Voting Timeline */}
            <div className="ballot-card ballot-card-hover p-6">
              <h3 className="font-bold text-slate-900 mb-4">Voting Timeline</h3>
              <div className="space-y-4">
                {[
                  { step: "Verified", icon: CheckCircle, completed: true },
                  { step: "Vote", icon: Clock, completed: !selectedCandidate },
                  { step: "Confirm", icon: Clock, completed: !selectedCandidate },
                  { step: "Blockchain", icon: Clock, completed: !selectedCandidate },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <item.icon
                      className={`w-5 h-5 flex-shrink-0 ${item.completed ? "text-green-500" : "text-gray-400"}`}
                    />
                    <span className={item.completed ? "text-gray-600" : "text-gray-400"}>{item.step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <VoteConfirmationModal
          candidateName={candidates.find((c) => c.id === selectedCandidate)?.name || ""}
          onConfirm={handleVoteSubmit}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  )
}

function VoteConfirmationModal({
  candidateName,
  onConfirm,
  onCancel,
}: {
  candidateName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    await onConfirm()
  }

  const mockHash = "0xab73f1j3d0a9k2l8m9n0o1p2q3r4s5t6u7v8w9x0"

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="ballot-card max-w-md p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Confirm Your Vote</h2>

        <div className="bg-slate-100 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 mb-2">You are voting for:</p>
          <p className="text-lg font-bold text-slate-900">{candidateName}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-900">
            <strong>Warning:</strong> Once submitted, your vote cannot be changed. Please verify carefully.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-xs text-gray-600 mb-2">Vote Hash (for verification):</p>
          <code className="text-xs font-mono break-all text-gray-700">{mockHash}</code>
        </div>

        <p className="text-sm text-gray-600 mb-6 text-center">
          "Your vote is anonymous, encrypted, and permanently recorded on the blockchain."
        </p>

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-slate-900 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 ballot-secondary-btn flex items-center justify-center gap-2 ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Submitting..." : "Submit Vote"}
          </button>
        </div>
      </div>
    </div>
  )
}

function VoteConfirmationScreen() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200">
        <div className="ballot-container py-4">
          <h1 className="text-2xl font-bold text-slate-900">BALLOT Dashboard</h1>
        </div>
      </header>

      <div className="ballot-container py-16 flex items-center justify-center">
        <div className="ballot-card max-w-2xl p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-4">Vote Successfully Submitted</h1>

          <p className="text-gray-600 mb-8 text-lg">
            Your vote has been securely recorded on the blockchain. Your vote is anonymous, encrypted, and permanent.
          </p>

          {/* Transaction Details */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Transaction Hash", value: "0x7f3e9d2a1b4c..." },
              { label: "Block Number", value: "#18,456,890" },
              { label: "Timestamp", value: "2025-03-15 14:32:45 UTC" },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-100 rounded-xl p-4">
                <p className="text-xs text-gray-600 mb-2">{item.label}</p>
                <p className="font-mono text-sm font-semibold text-slate-900 break-all">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-bold text-slate-900 mb-4">What's Next?</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold">1.</span>
                <span>Your vote has been encrypted and stored on the blockchain.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold">2.</span>
                <span>Results will be published after voting closes on March 15, 2025.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold">3.</span>
                <span>You can verify your vote using the transaction hash above.</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <a href="/results" className="flex-1 ballot-secondary-btn flex items-center justify-center gap-2">
              View Live Results
            </a>
            <a
              href="/"
              className="flex-1 px-6 py-3 border border-gray-300 text-slate-900 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
