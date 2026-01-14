"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, LogOut, ChevronRight, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

export default function VoterDashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [electionName, setElectionName] = useState("Loading Election...")
  const [electionState, setElectionState] = useState(0) // 0=Created, 1=Voting, 2=Ended

  // Restore missing state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedFor, setVotedFor] = useState<number | null>(null)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (authLoading) return // Wait for auth init
    if (!user) {
      router.push('/login')
      return
    }

    const loadData = async () => {
      try {
        // 1. Fetch Election Stats (Name, Candidates, State)
        const statsRes = await fetch('/api/election/stats')
        const statsData = await statsRes.json()

        if (statsData) {
          setElectionName(statsData.electionName || "Current Election")
          setCandidates(statsData.candidates || [])
          setElectionState(statsData.state ?? 0)
        }

        // 2. Check Vote Status
        if (user.uid) {
          const statusRes = await fetch(`/api/election/vote?uid=${user.uid}`)
          const statusData = await statusRes.json()
          if (statusData.hasVoted) {
            setHasVoted(true)
            setVotedFor(statusData.voterInfo?.votedFor)
            setTransactionHash(statusData.voterInfo?.transactionHash)
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
        toast.error("Failed to load election data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, router, authLoading])

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      router.push('/')
    } catch (error) {
      toast.error('Failed to sign out')
    }
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  const handleVoteSubmit = async () => {
    // Determine the correct ID to send (prefer blockchain_id if available)
    const candidate = candidates.find(c => c.id === selectedCandidate)
    if (!candidate || !user) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/election/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.blockchainId || candidate.id, // Use the ID the contract expects
          firebaseUid: user.uid,
          candidateName: candidate.name
        })
      })

      const data = await res.json()

      if (res.ok) {
        setTransactionHash(data.transactionHash)
        setHasVoted(true)
        setShowConfirmation(false)
        toast.success("Vote submitted successfully!")
      } else {
        throw new Error(data.error || "Vote submission failed")
      }
    } catch (error: any) {
      console.error("Vote error:", error)
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (hasVoted) {
    return <VoteConfirmationScreen txHash={transactionHash} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="ballot-container py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">BALLOT Dashboard</h1>
          <div className="flex items-center gap-4">
            {user?.displayName && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                </div>
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full border-2 border-teal-500"
                  />
                )}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-slate-900 flex items-center gap-2 font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
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
              <h2 className="text-lg font-bold text-slate-900 mb-4">{electionName}</h2>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className={`font-semibold ${electionState === 1 ? 'text-green-600 animate-pulse' : 'text-slate-900'}`}>
                    {electionState === 0 ? 'Created (Not Started)' : electionState === 1 ? 'Live / Voting' : 'Ended'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Candidates</p>
                  <p className="font-semibold text-slate-900">{candidates.length}</p>
                </div>
              </div>
            </div>

            {/* Candidates */}
            <div className="ballot-card ballot-card-hover p-6 mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Select Your Candidate</h2>

              {electionState !== 1 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center">
                  Voting is currently <strong>{electionState === 0 ? 'Not Started' : 'Closed'}</strong>.
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedCandidate === candidate.id
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 hover:border-slate-900"
                        }`}
                      onClick={() => setSelectedCandidate(candidate.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 mb-1">{candidate.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{candidate.party}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${selectedCandidate === candidate.id ? "border-teal-500 bg-teal-500" : "border-gray-300"
                            }`}
                        >
                          {selectedCandidate === candidate.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {candidates.length === 0 && (
                    <p className="text-gray-500">No candidates available.</p>
                  )}
                </div>
              )}

              {/* Cast Vote Button */}
              {electionState === 1 && (
                <div className="mt-8">
                  <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!selectedCandidate}
                    className={`w-full ballot-primary-btn flex items-center justify-center gap-2 ${!selectedCandidate ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                  >
                    Cast Vote Securely
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* Important Notice */}
            <div className="ballot-card ballot-card-hover p-6 mb-6 border-l-4 border-amber-500">
              <div className="flex gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
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
                      className={`w-5 h-5 shrink-0 ${item.completed ? "text-green-500" : "text-gray-400"}`}
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
          loading={submitting}
        />
      )}
    </div>
  )
}

function VoteConfirmationModal({
  candidateName,
  onConfirm,
  onCancel,
  loading
}: {
  candidateName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {


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

        <p className="text-sm text-gray-600 mb-6 text-center">
          "Your vote will be encrypted, anonymized, and permanently recorded on the blockchain."
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
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 ballot-secondary-btn flex items-center justify-center gap-2 ${loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
          >
            {loading ? "Submitting..." : "Submit Vote"}
          </button>
        </div>
      </div>
    </div>
  )
}

function VoteConfirmationScreen({ txHash }: { txHash: string | null }) {
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
              { label: "Transaction Hash", value: txHash || "Pending..." },
              { label: "Block Number", value: "Pending" },
              { label: "Timestamp", value: new Date().toUTCString() },
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
