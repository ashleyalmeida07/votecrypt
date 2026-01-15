"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, LogOut, ChevronRight, AlertTriangle, Shield } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { getVoterSecrets, storeVoterSecrets, VoterSecrets } from "@/lib/zkp"

export default function VoterDashboard() {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<any[]>([])
  const [electionName, setElectionName] = useState("Loading Election...")
  const [electionState, setElectionState] = useState(0) // 0=Created, 1=Voting, 2=Ended
  const [electionId, setElectionId] = useState<number | null>(null)

  // ZKP state
  const [zkpSecrets, setZkpSecrets] = useState<VoterSecrets | null>(null)
  const [zkpRegistering, setZkpRegistering] = useState(false)

  // Restore missing state
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedFor, setVotedFor] = useState<number | null>(null)
  const [transactionHash, setTransactionHash] = useState<string | null>(null)
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [voteTimestamp, setVoteTimestamp] = useState<string | null>(null)
  const [nullifierHash, setNullifierHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { user, signOut, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (authLoading) return // Wait for auth init

    const checkUserAndLoadData = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      // Check if user exists in database
      try {
        const checkResponse = await fetch('/api/auth/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid: user.uid,
            email: user.email
          })
        });

        const checkData = await checkResponse.json();

        if (!checkData.exists) {
          // User not in database, redirect to signup
          await signOut();
          toast.error("Please sign up first to access the dashboard");
          router.push('/signup');
          return;
        }

        // Check if user has uploaded and verified voter ID
        const voterIdResponse = await fetch(`/api/voter-id/status?firebaseUid=${user.uid}`);
        const voterIdData = await voterIdResponse.json();

        if (!voterIdData.hasVoterId || !voterIdData.isVerified) {
          // User hasn't uploaded voter ID, redirect to upload page
          toast.error("Please upload and verify your Voter ID to access the dashboard");
          router.push('/upload-voter-id');
          return;
        }

        // User exists and has verified voter ID, proceed with loading data
        await loadData();
      } catch (error) {
        console.error('Failed to verify user:', error);
        toast.error("Failed to verify user account");
        await signOut();
        router.push('/login');
      }
    };

    checkUserAndLoadData();
  }, [user, authLoading, router, signOut]);

  const loadData = async () => {
    if (!user) return;

    try {
      // 1. Fetch Election Stats (Name, Candidates, State)
      const statsRes = await fetch('/api/election/stats')
      const statsData = await statsRes.json()

      let currentElectionId: number | null = null

      if (statsData) {
        setElectionName(statsData.electionName || "Current Election")
        setCandidates(statsData.candidates || [])
        setElectionState(statsData.state ?? 0)
        currentElectionId = statsData.electionId || null
        setElectionId(currentElectionId)

        // Load ZKP secrets from localStorage if available
        if (currentElectionId) {
          console.log('🔍 Checking for ZKP secrets, electionId:', currentElectionId)
          let secrets = getVoterSecrets(currentElectionId)
          console.log('🔍 Existing secrets:', secrets ? 'FOUND' : 'NOT FOUND')

          // AUTO-REGISTER: If no secrets exist, automatically register for ZKP
          if (!secrets && user.uid) {
            console.log('🔐 Auto-registering for anonymous voting...')
            console.log('🔐 User UID:', user.uid)
            try {
              console.log('📤 Calling /api/election/zkp/register...')
              const res = await fetch('/api/election/zkp/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firebaseUid: user.uid })
              })

              console.log('📥 Response status:', res.status, res.ok ? 'OK' : 'FAILED')
              const data = await res.json()
              console.log('📥 Response data:', JSON.stringify(data).slice(0, 200))

              if (res.ok && data.secrets) {
                secrets = {
                  secret: data.secrets.secret,
                  nullifierSecret: data.secrets.nullifierSecret,
                  commitment: data.secrets.commitment,
                  registeredAt: new Date().toISOString()
                }
                storeVoterSecrets(currentElectionId, secrets)
                console.log('✅ Anonymous voting enabled automatically, secrets stored')
              } else {
                console.error('❌ Registration failed:', data.error || 'Unknown error')
              }
            } catch (regError) {
              console.error('❌ Auto-registration exception:', regError)
            }
          }

          console.log('🔍 Final secrets state:', secrets ? 'SET' : 'NULL')
          setZkpSecrets(secrets)
        } else {
          console.log('⚠️ No currentElectionId, skipping ZKP setup')
        }
      }

      // 2. Check Vote Status (with ZKP nullifier if available)
      if (user.uid && currentElectionId) {
        const loadedSecrets = getVoterSecrets(currentElectionId)
        let url = `/api/election/vote?uid=${user.uid}`
        if (loadedSecrets?.nullifierSecret) {
          url += `&nullifierSecret=${loadedSecrets.nullifierSecret}`
        }
        const statusRes = await fetch(url)
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

  // ZKP Registration handler
  const handleZkpRegister = async () => {
    if (!user || !electionId) return

    setZkpRegistering(true)
    try {
      const res = await fetch('/api/election/zkp/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseUid: user.uid })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      // Store secrets
      const secrets: VoterSecrets = {
        secret: data.secrets.secret,
        nullifierSecret: data.secrets.nullifierSecret,
        commitment: data.secrets.commitment,
        registeredAt: new Date().toISOString()
      }

      storeVoterSecrets(electionId, secrets)
      setZkpSecrets(secrets)
      toast.success('Anonymous voting enabled! Your identity is now protected.')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setZkpRegistering(false)
    }
  }

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
    // Find the selected candidate
    const candidate = candidates.find(c => c.id === selectedCandidate)
    if (!candidate || !user) return

    // CRITICAL: ZKP voting is compulsory
    if (!zkpSecrets) {
      toast.error('Please enable anonymous voting first')
      return
    }

    const blockchainId = candidate.blockchainId ?? candidate.id

    console.log('ZKP Vote submission:', {
      candidateId: blockchainId,
      candidateName: candidate.name,
      hasSecrets: !!zkpSecrets
    })

    setSubmitting(true)
    try {
      const res = await fetch('/api/election/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: zkpSecrets.secret,
          nullifierSecret: zkpSecrets.nullifierSecret,
          candidateId: blockchainId,
          firebaseUid: user.uid
        })
      })

      const data = await res.json()

      if (res.ok) {
        setNullifierHash(data.nullifierHash)
        setVoteTimestamp(data.timestamp)
        setHasVoted(true)
        setShowConfirmation(false)
        toast.success("Anonymous vote submitted successfully!")
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
    return <VoteConfirmationScreen txHash={transactionHash} blockNumber={blockNumber} timestamp={voteTimestamp} nullifierHash={nullifierHash} />
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

            {/* ZKP Anonymous Voting Status - Always enabled automatically */}
            <div className="ballot-card p-6 mb-8 bg-gradient-to-r from-green-50 to-teal-50 border-green-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-800">Anonymous Voting Enabled</h2>
                  <p className="text-green-700 text-sm">
                    {zkpSecrets
                      ? "Your identity is protected with Zero Knowledge Proofs"
                      : "Setting up anonymous voting..."}
                  </p>
                </div>
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

function VoteConfirmationScreen({ txHash, blockNumber, timestamp, nullifierHash }: {
  txHash: string | null
  blockNumber: number | null
  timestamp: string | null
  nullifierHash: string | null
}) {
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

          <h1 className="text-3xl font-bold text-slate-900 mb-4">Anonymous Vote Submitted!</h1>

          <p className="text-gray-600 mb-8 text-lg">
            Your vote has been securely recorded using Zero Knowledge Proofs. Your identity is completely anonymous.
          </p>

          {/* Vote Proof Details */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-100 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-2">Anonymity Proof (Nullifier)</p>
              <p className="font-mono text-sm font-semibold text-slate-900 break-all">
                {nullifierHash ? `${nullifierHash.slice(0, 18)}...${nullifierHash.slice(-8)}` : "Verifying..."}
              </p>
            </div>
            <div className="bg-slate-100 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-2">Timestamp</p>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-bold text-green-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Your Privacy is Protected
            </h3>
            <ul className="space-y-3 text-sm text-green-700">
              <li className="flex gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <span>Your identity is hidden using Zero Knowledge Proofs</span>
              </li>
              <li className="flex gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <span>Only the nullifier above is recorded (not your identity)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <span>Double-voting is prevented without revealing who voted</span>
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
