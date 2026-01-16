"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, BarChart3, CheckCircle, Clock, AlertCircle, Loader2, Plus, UserPlus, LogOut, ExternalLink } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface Candidate {
  id: number
  name: string
  party: string
  voteCount: number
}

interface ElectionStats {
  electionName: string
  electionOfficial: string
  state: number
  stateName: string
  candidateCount: number
  totalVotes: number
  candidates: Candidate[]
  contractAddress: string
  blockExplorer?: string
  chain?: string
  chainId?: number
}

export default function AdminPanel() {
  const [stats, setStats] = useState<ElectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showFinalResults, setShowFinalResults] = useState(false)
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { user, signInWithGoogle, signOut } = useAuth()
  const router = useRouter()

  // Form states
  const [newCandidateName, setNewCandidateName] = useState("")
  const [newCandidateParty, setNewCandidateParty] = useState("")
  const [voterAddress, setVoterAddress] = useState("")
  const [newElectionName, setNewElectionName] = useState("")

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/election/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error('Failed to load election data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (adminAuthenticated) {
      fetchStats()
      // Poll for updates every 5 seconds for responsive UI
      const interval = setInterval(fetchStats, 5000)
      return () => clearInterval(interval)
    }
  }, [adminAuthenticated, fetchStats])

  useEffect(() => {
    const verifyAdminAccess = async () => {
      if (!user?.email) {
        setAdminAuthenticated(false)
        setCheckingAuth(false)
        return
      }

      try {
        const response = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email })
        })

        const data = await response.json()

        if (data.isAuthorized) {
          setAdminAuthenticated(true)
          toast.success(`Welcome, ${user.displayName || 'Admin'}!`)
        } else {
          setAdminAuthenticated(false)
          await signOut()
          toast.error(data.message || 'Access denied. You are not authorized to access the admin panel.')
          setTimeout(() => router.push('/'), 2000)
        }
      } catch (error) {
        console.error('Admin verification error:', error)
        setAdminAuthenticated(false)
        toast.error('Failed to verify admin access')
      } finally {
        setCheckingAuth(false)
      }
    }

    verifyAdminAccess()
  }, [user, signOut, router])

  const handleAdminLogout = async () => {
    await signOut()
    setAdminAuthenticated(false)
    toast.success('Logged out successfully')
    router.push('/')
  }

  const handleElectionAction = async (action: "start" | "end" | "newElection") => {
    setActionLoading(action)
    try {
      const body: { action: string; newName?: string } = { action }
      if (action === 'newElection') {
        if (!newElectionName.trim()) {
          toast.error('Please enter a name for the new election')
          setActionLoading(null)
          return
        }
        body.newName = newElectionName.trim()
      }

      const res = await fetch('/api/election/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Action failed')

      // Optimistic UI: Update local state immediately if possible or just trigger one fetch
      await fetchStats()

      // Show success toast with link to explorer
      toast.success(`Action submitted!`, {
        description: (
          <div>
            <p>{data.message}</p>
            {data.warning && <p className="text-amber-600 text-xs mt-1">{data.warning}</p>}
            {data.explorerUrl && (
              <a
                href={data.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline text-sm mt-1 block"
              >
                View Transaction →
              </a>
            )}
          </div>
        ),
        duration: 5000,
      })

      // Clear new election name input
      if (action === 'newElection') {
        setNewElectionName('')
      }

    } catch (error: any) {
      toast.error(`Failed to ${action === 'newElection' ? 'start new' : action} election`, {
        description: error.message,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCandidateName || !newCandidateParty) {
      toast.error('Please fill in all fields')
      return
    }

    setActionLoading('addCandidate')
    try {
      const res = await fetch('/api/election/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCandidateName, party: newCandidateParty }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to add candidate')

      toast.success('Candidate added successfully!', {
        description: `${newCandidateName} (${newCandidateParty})`,
      })

      setNewCandidateName("")
      setNewCandidateParty("")
      await fetchStats()
    } catch (error: any) {
      toast.error('Failed to add candidate', {
        description: error.message,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voterAddress) {
      toast.error('Please enter a voter address')
      return
    }

    setActionLoading('registerVoter')
    try {
      const res = await fetch('/api/election/voters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: voterAddress }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to register voter')

      toast.success('Voter registered successfully!', {
        description: `${voterAddress.slice(0, 10)}...${voterAddress.slice(-8)}`,
      })

      setVoterAddress("")
    } catch (error: any) {
      toast.error('Failed to register voter', {
        description: error.message,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const electionState = stats?.stateName?.toLowerCase().replace(' ', '_') || 'not_started'
  const stateToUIState = (state: number) => {
    switch (state) {
      case 0: return 'not_started'
      case 1: return 'active'
      case 2: return 'closed'
      default: return 'not_started'
    }
  }

  const voteTimestampData = [
    { time: "Start", votes: 0 },
    { time: "Current", votes: stats?.totalVotes || 0 },
  ]

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!adminAuthenticated) {
    return <AdminLoginPage />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading election data from blockchain...</p>
        </div>
      </div>
    )
  }

  const uiState = stats ? stateToUIState(stats.state) : 'not_started'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b">
        <div className="max-w-350 mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">VoteCrypt Admin Panel</h1>
              {stats?.electionName && (
                <p className="text-sm text-muted-foreground">{stats.electionName}</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleAdminLogout}
            variant="ghost"
            size="sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-350 mx-auto px-4 py-8">
        {/* Alert Banner */}
        <Alert className="mb-8 border-l-4 border-primary">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription>
            <h3 className="font-bold">Live Blockchain Connection</h3>
            <p className="text-sm">
              Connected to smart contract. All actions are recorded on the blockchain.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          {/* Election Status */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Election Status</p>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    uiState === "active" ? "bg-green-500 animate-pulse" :
                    uiState === "closed" ? "bg-red-500" : "bg-gray-400"
                  }`}
                ></div>
                <p className="text-lg font-bold">{stats?.stateName || "Unknown"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Total Votes */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Votes Cast</p>
              <p className="text-3xl font-bold">{stats?.totalVotes?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">On-chain verified</p>
            </CardContent>
          </Card>

          {/* Candidates */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Candidates</p>
              <p className="text-3xl font-bold text-primary">{stats?.candidateCount || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">Registered on contract</p>
            </CardContent>
          </Card>

          {/* Results Published */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Results Published</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showFinalResults}
                  onChange={(e) => setShowFinalResults(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-bold">{showFinalResults ? "Yes" : "No"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Make results public</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Vote Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Vote Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-6xl font-bold">{stats?.totalVotes?.toLocaleString() || 0}</p>
                  <p className="text-muted-foreground mt-2">Total votes recorded on blockchain</p>
                </div>
              </CardContent>
            </Card>

            {/* Candidate Vote Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Current Vote Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.candidates && stats.candidates.length > 0 ? (
                  <div className="space-y-6">
                    {stats.candidates.map((candidate) => (
                      <div key={candidate.id}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-bold">{candidate.name}</h3>
                            <p className="text-xs text-muted-foreground">{candidate.party}</p>
                          </div>
                          <p className="font-bold">{candidate.voteCount} votes</p>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="h-full rounded-full transition-all bg-primary"
                            style={{
                              width: `${stats.totalVotes > 0 ? (candidate.voteCount / stats.totalVotes) * 100 : 0}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No candidates registered yet</p>
                )}
              </CardContent>
            </Card>

            {/* Add Candidate Form */}
            {stats?.state === 0 && (
              <div className="ballot-card ballot-card-hover p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Candidate
                </h2>
                <form onSubmit={handleAddCandidate} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Candidate Name</label>
                      <input
                        type="text"
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        placeholder="Enter candidate name"
                        className="ballot-input"
                        disabled={actionLoading === 'addCandidate'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Party/Affiliation</label>
                      <input
                        type="text"
                        value={newCandidateParty}
                        onChange={(e) => setNewCandidateParty(e.target.value)}
                        placeholder="Enter party name"
                        className="ballot-input"
                        disabled={actionLoading === 'addCandidate'}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading === 'addCandidate'}
                    className="ballot-primary-btn flex items-center gap-2"
                  >
                    {actionLoading === 'addCandidate' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add Candidate
                  </button>
                </form>
              </div>
            )}

            {/* Register Voter Form */}
            {stats?.state !== 2 && (
              <div className="ballot-card ballot-card-hover p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Register Voter
                </h2>
                <form onSubmit={handleRegisterVoter} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address</label>
                    <input
                      type="text"
                      value={voterAddress}
                      onChange={(e) => setVoterAddress(e.target.value)}
                      placeholder="0x..."
                      className="ballot-input font-mono"
                      disabled={actionLoading === 'registerVoter'}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading === 'registerVoter'}
                    className="ballot-primary-btn flex items-center gap-2"
                  >
                    {actionLoading === 'registerVoter' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    Register Voter
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Election Control */}
            <div className="ballot-card ballot-card-hover p-6">
              <h3 className="font-bold text-slate-900 mb-4">Election Control</h3>

              {/* Current State Indicator */}
              <div className="mb-4 p-3 rounded-lg bg-gray-50 border">
                <p className="text-xs text-gray-500 uppercase">Current State</p>
                <p className={`font-bold text-lg ${stats?.state === 0 ? 'text-blue-600' :
                  stats?.state === 1 ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                  {stats?.state === 0 ? '📋 Created' :
                    stats?.state === 1 ? '🗳️ Voting' :
                      stats?.state === 2 ? '✅ Ended' : 'Loading...'}
                </p>
              </div>

              <div className="space-y-3">
                {/* Start Election Button */}
                <div>
                  <button
                    onClick={() => handleElectionAction('start')}
                    disabled={stats?.state !== 0 || actionLoading !== null}
                    className={`w-full px-4 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${stats?.state === 0 && actionLoading === null
                      ? "ballot-primary-btn hover:opacity-90"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    {actionLoading === 'start' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {actionLoading === 'start' ? 'Starting...' : 'Start Election'}
                  </button>
                  {stats?.state !== 0 && stats?.state !== undefined && (
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      {stats?.state === 1 ? 'Election is already in progress' : 'Election has ended'}
                    </p>
                  )}
                </div>

                {/* End Election Button */}
                <div>
                  <button
                    onClick={() => handleElectionAction('end')}
                    disabled={stats?.state !== 1 || actionLoading !== null}
                    className={`w-full px-4 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${stats?.state === 1 && actionLoading === null
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                  >
                    {actionLoading === 'end' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {actionLoading === 'end' ? 'Ending...' : 'End Election'}
                  </button>
                  {stats?.state !== 1 && stats?.state !== undefined && (
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      {stats?.state === 0 ? 'Start election first' : 'Election already ended'}
                    </p>
                  )}
                </div>

                {/* Start New Election Section (only when election is ended) */}
                {stats?.state === 2 && (
                  <div className="pt-4 mt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-3">Start a new election cycle:</p>
                    <input
                      type="text"
                      value={newElectionName}
                      onChange={(e) => setNewElectionName(e.target.value)}
                      placeholder="New election name..."
                      className="ballot-input mb-2 text-sm"
                      disabled={actionLoading !== null}
                    />
                    <button
                      onClick={() => handleElectionAction('newElection')}
                      disabled={!newElectionName.trim() || actionLoading !== null}
                      className={`w-full px-4 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${newElectionName.trim() && actionLoading === null
                        ? "bg-teal-600 text-white hover:bg-teal-700"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      {actionLoading === 'newElection' && <Loader2 className="w-4 h-4 animate-spin" />}
                      Start New Election
                    </button>
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ This will clear all candidates and votes
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Smart Contract Info */}
            <div className="ballot-card ballot-card-hover p-6 border-l-4 border-teal-500">
              <h3 className="font-bold text-slate-900 mb-4">Smart Contract Status</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Contract Address</p>
                  <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all mt-1 text-gray-700">
                    {stats?.contractAddress || "Not configured"}
                  </code>
                </div>
                <div>
                  <p className="text-gray-600">Election Official</p>
                  <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all mt-1 text-gray-700">
                    {stats?.electionOfficial?.slice(0, 10)}...{stats?.electionOfficial?.slice(-8)}
                  </code>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Connected
                  </p>
                </div>
                {stats?.contractAddress && stats?.blockExplorer && (
                  <div className="pt-2">
                    <a
                      href={`${stats.blockExplorer}/address/${stats.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Block Explorer
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchStats}
              className="w-full ballot-card ballot-card-hover p-4 text-center font-medium text-teal-600 hover:bg-teal-50 transition-colors"
            >
              Refresh Data
            </button>

            {/* Audit Log */}
            <div className="ballot-card ballot-card-hover p-6 bg-gray-50">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Audit Log
              </h3>
              <p className="text-xs text-gray-600">
                All administrator actions are logged for transparency and accountability. Access the complete audit
                trail on the blockchain.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle } = useAuth()

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
      // Verification happens in parent component's useEffect
    } catch (error: any) {
      console.error("Admin sign in error:", error)
      toast.error(error.message || "Failed to sign in")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-16 h-16" />
          </div>
          <div>
            <CardTitle className="text-3xl">VoteCrypt Admin</CardTitle>
            <CardDescription className="mt-2">
              Election Authority Access Portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-amber-500 bg-amber-50">
            <Shield className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>Restricted Access:</strong> Only authorized election officials can access this panel.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
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
                Sign in with Google
              </>
            )}
          </Button>

          <div className="text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Back to Home
            </Link>
          </div>

          <Alert variant="default" className="text-xs">
            <AlertDescription>
              All access attempts are logged and monitored. Unauthorized access is prohibited.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
