"use client"
import { useState, useEffect, useCallback } from "react"
import type React from "react"

import { Shield, BarChart3, CheckCircle, Clock, AlertCircle, Loader2, Plus, UserPlus } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { toast } from "sonner"

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
}

export default function AdminPanel() {
  const [stats, setStats] = useState<ElectionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showFinalResults, setShowFinalResults] = useState(false)
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminPassword === "admin123") {
      setAdminAuthenticated(true)
    } else {
      toast.error("Invalid password")
    }
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

      // Show pending toast with link to explorer
      toast.info('Transaction submitted!', {
        description: (
          <div>
            <p>Waiting for blockchain confirmation...</p>
            {data.explorerUrl && (
              <a
                href={data.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline text-sm"
              >
                View on Etherscan →
              </a>
            )}
          </div>
        ),
        duration: 15000,
      })

      // Clear new election name input
      if (action === 'newElection') {
        setNewElectionName('')
      }

      // Poll for state change - check every 3 seconds for up to 30 seconds
      let attempts = 0
      const maxAttempts = 10
      const pollInterval = setInterval(async () => {
        attempts++
        await fetchStats()

        // Check if state has changed
        const expectedState = action === 'start' ? 1 : action === 'end' ? 2 : 0
        if (stats?.state === expectedState || attempts >= maxAttempts) {
          clearInterval(pollInterval)
          if (stats?.state === expectedState) {
            toast.success(`Election ${action === 'start' ? 'started' : action === 'end' ? 'ended' : 'created'} successfully!`)
          }
        }
      }, 3000)

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

  if (!adminAuthenticated) {
    return <AdminLoginPage onLogin={handleLogin} password={adminPassword} setPassword={setAdminPassword} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading election data from blockchain...</p>
        </div>
      </div>
    )
  }

  const uiState = stats ? stateToUIState(stats.state) : 'not_started'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="ballot-container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">BALLOT Admin Panel</h1>
              {stats?.electionName && (
                <p className="text-sm text-gray-600">{stats.electionName}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setAdminAuthenticated(false)}
            className="text-gray-600 hover:text-slate-900 font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="ballot-container py-8">
        {/* Alert Banner */}
        <div className="ballot-card ballot-card-hover p-4 bg-blue-50 border-l-4 border-teal-500 mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900">Live Blockchain Connection</h3>
            <p className="text-sm text-gray-600">
              Connected to smart contract. All actions are recorded on the blockchain.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          {/* Election Status */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Election Status</p>
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${uiState === "active" ? "bg-green-500 animate-pulse" :
                  uiState === "closed" ? "bg-red-500" : "bg-gray-400"
                  }`}
              ></div>
              <p className="text-lg font-bold text-slate-900">{stats?.stateName || "Unknown"}</p>
            </div>
          </div>

          {/* Total Votes */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total Votes Cast</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.totalVotes?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500 mt-2">On-chain verified</p>
          </div>

          {/* Candidates */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Candidates</p>
            <p className="text-3xl font-bold text-teal-600">{stats?.candidateCount || 0}</p>
            <p className="text-xs text-gray-500 mt-2">Registered on contract</p>
          </div>

          {/* Results Published */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Results Published</p>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showFinalResults}
                onChange={(e) => setShowFinalResults(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-bold text-slate-900">{showFinalResults ? "Yes" : "No"}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Make results public</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Vote Timeline */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Vote Count</h2>
              <div className="text-center py-8">
                <p className="text-6xl font-bold text-slate-900">{stats?.totalVotes?.toLocaleString() || 0}</p>
                <p className="text-gray-600 mt-2">Total votes recorded on blockchain</p>
              </div>
            </div>

            {/* Candidate Vote Breakdown */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Current Vote Distribution</h2>
              {stats?.candidates && stats.candidates.length > 0 ? (
                <div className="space-y-6">
                  {stats.candidates.map((candidate) => (
                    <div key={candidate.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                          <p className="text-xs text-gray-600">{candidate.party}</p>
                        </div>
                        <p className="font-bold text-slate-900">{candidate.voteCount} votes</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-full rounded-full transition-all bg-teal-500"
                          style={{
                            width: `${stats.totalVotes > 0 ? (candidate.voteCount / stats.totalVotes) * 100 : 0}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No candidates registered yet</p>
              )}
            </div>

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

function AdminLoginPage({
  onLogin,
  password,
  setPassword,
}: {
  onLogin: (e: React.FormEvent) => void
  password: string
  setPassword: (pwd: string) => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">BALLOT</h1>
          <p className="text-gray-300 mt-2">Admin Panel</p>
        </div>

        {/* Login Card */}
        <div className="ballot-card p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Election Authority Access</h2>

          <form onSubmit={onLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-900 mb-2">Administrator Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="ballot-input"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                For demo purposes, use: <code className="font-mono">admin123</code>
              </p>
            </div>

            <button type="submit" className="ballot-primary-btn w-full">
              Access Admin Panel
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-900">
              <strong>Security Notice:</strong> This panel is restricted to authorized election officials only. All
              access is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
