"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, LogOut, ChevronRight, AlertTriangle, Shield } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { getVoterSecrets, storeVoterSecrets, VoterSecrets } from "@/lib/zkp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-350 mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-8 h-8" />
            <h1 className="text-2xl font-bold">VoteCrypt Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {user?.displayName && (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    className="w-10 h-10 rounded-full border-2 border-primary"
                  />
                )}
              </div>
            )}
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-350 mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Voter Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold mb-2">Voter Status</h2>
                    <p className="text-muted-foreground">Your identity has been verified</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            {/* ZKP Anonymous Voting Status - Always enabled automatically */}
            <Alert className="bg-green-50 border-green-200">
              <Shield className="h-5 w-5 text-green-600" />
              <AlertDescription>
                <h2 className="text-lg font-bold text-green-800 mb-1">Anonymous Voting Enabled</h2>
                <p className="text-green-700 text-sm">
                  {zkpSecrets
                    ? "Your identity is protected with Zero Knowledge Proofs"
                    : "Setting up anonymous voting..."}
                </p>
              </AlertDescription>
            </Alert>

            {/* Election Info */}
            <Card>
              <CardHeader>
                <CardTitle>{electionName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className={`font-semibold ${electionState === 1 ? 'text-green-600 animate-pulse' : ''}`}>
                      {electionState === 0 ? 'Created (Not Started)' : electionState === 1 ? 'Live / Voting' : 'Ended'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Candidates</p>
                    <p className="font-semibold">{candidates.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Candidates */}
            <Card>
              <CardHeader>
                <CardTitle>Select Your Candidate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {electionState !== 1 ? (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-amber-800 text-center">
                      Voting is currently <strong>{electionState === 0 ? 'Not Started' : 'Closed'}</strong>.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          selectedCandidate === candidate.id
                            ? "border-primary bg-accent"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedCandidate(candidate.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold mb-1">{candidate.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{candidate.party}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${
                              selectedCandidate === candidate.id
                                ? "border-primary bg-primary"
                                : "border-border"
                            }`}
                          >
                            {selectedCandidate === candidate.id && <div className="w-2 h-2 bg-background rounded-full"></div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {candidates.length === 0 && (
                      <p className="text-muted-foreground">No candidates available.</p>
                    )}
                  </div>
                )}

                {/* Cast Vote Button */}
                {electionState === 1 && (
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    disabled={!selectedCandidate}
                    size="lg"
                    className="w-full"
                  >
                    Cast Vote Securely
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Important Notice */}
            <Card className="border-l-4 border-amber-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Important Notice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>Votes cannot be changed once submitted</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>Your vote remains anonymous and encrypted</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>You can verify your vote on the blockchain</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Voting Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Voting Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { step: "Verified", icon: CheckCircle, completed: true },
                    { step: "Vote", icon: Clock, completed: !selectedCandidate },
                    { step: "Confirm", icon: Clock, completed: !selectedCandidate },
                    { step: "Blockchain", icon: Clock, completed: !selectedCandidate },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <item.icon
                        className={`w-5 h-5 shrink-0 ${item.completed ? "text-green-500" : "text-muted-foreground"}`}
                      />
                      <span className={item.completed ? "text-muted-foreground" : "text-muted-foreground/50"}>{item.step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Confirm Your Vote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-accent rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-2">You are voting for:</p>
            <p className="text-lg font-bold">{candidateName}</p>
          </div>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>Warning:</strong> Once submitted, your vote cannot be changed. Please verify carefully.
            </AlertDescription>
          </Alert>

          <p className="text-sm text-muted-foreground text-center">
            Your vote will be encrypted, anonymized, and permanently recorded on the blockchain.
          </p>

          <div className="flex gap-4">
            <Button
              onClick={onCancel}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Submitting..." : "Submit Vote"}
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b">
        <div className="max-w-350 mx-auto px-4 py-4 flex items-center gap-2">
          <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-8 h-8" />
          <h1 className="text-2xl font-bold">VoteCrypt Dashboard</h1>
        </div>
      </header>

      <div className="max-w-350 mx-auto px-4 py-16 flex items-center justify-center">
        <Card className="max-w-2xl w-full">
          <CardContent className="pt-12 pb-12 text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold mb-4">Anonymous Vote Submitted!</h1>
              <p className="text-muted-foreground text-lg">
                Your vote has been securely recorded using Zero Knowledge Proofs. Your identity is completely anonymous.
              </p>
            </div>

            {/* Vote Proof Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-accent rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-2">Anonymity Proof (Nullifier)</p>
                <p className="font-mono text-sm font-semibold break-all">
                  {nullifierHash ? `${nullifierHash.slice(0, 18)}...${nullifierHash.slice(-8)}` : "Verifying..."}
                </p>
              </div>
              <div className="bg-accent rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-2">Timestamp</p>
                <p className="font-mono text-sm font-semibold">
                  {timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
                </p>
              </div>
            </div>

            <Alert className="bg-green-50 border-green-200 text-left">
              <Shield className="h-5 w-5 text-green-600" />
              <AlertDescription>
                <h3 className="font-bold text-green-800 mb-3">Your Privacy is Protected</h3>
                <ul className="space-y-3 text-sm text-green-700">
                  <li className="flex gap-3">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Your identity is hidden using Zero Knowledge Proofs</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Only the nullifier above is recorded (not your identity)</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Double-voting is prevented without revealing who voted</span>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button asChild className="flex-1" size="lg">
                <a href="/results">View Live Results</a>
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <a href="/">Back to Home</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
