"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Shield, RefreshCw, CheckCircle, BarChart3, Trophy } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([])
  const [election, setElection] = useState<any>(null)
  const [metadata, setMetadata] = useState({ totalVotes: 0, lastUpdated: new Date() })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [winner, setWinner] = useState<any>(null)
  const [isEnded, setIsEnded] = useState(false)

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/results')
      const data = await res.json()
      if (data.success) {
        setResults(data.results)
        setElection(data.election)
        setMetadata({
          totalVotes: data.totalVotes,
          lastUpdated: new Date(data.lastUpdated)
        })
        setWinner(data.winner)
        setIsEnded(data.isEnded || false)
      }
    } catch (error) {
      console.error("Failed to fetch results:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      // First sync with blockchain
      const syncRes = await fetch('/api/db/sync', { method: 'POST' })
      const syncData = await syncRes.json()

      if (syncData.success) {
        // Then refresh local results
        await fetchResults()
      }
    } catch (error) {
      console.error("Sync failed:", error)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchResults, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const chartData = results.map((candidate) => ({
    name: candidate.name,
    votes: candidate.vote_count,
  }))

  const COLORS = ["#0f172a", "#14b8a6", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6"]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="ballot-container flex items-center justify-between py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-900 hover:opacity-80 transition-opacity">
            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-8 h-8" />
            <span className="text-2xl font-bold">VoteCrypt</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="/" className="text-gray-600 hover:text-slate-900 font-medium transition-colors">
              Home
            </a>
            <Link href="/login" className="ballot-secondary-btn">
              Vote Now
            </Link>
          </div>
        </div>
      </nav>

      <div className="ballot-container py-12">
        {/* Header */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Live Election Results</h1>
            <p className="text-gray-600 text-lg">
              {election?.name || "Election"} - Results updated in real-time from the blockchain
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${syncing
              ? "bg-teal-100 text-teal-700 cursor-wait"
              : "bg-teal-600 text-white hover:bg-teal-700 shadow-lg hover:shadow-xl"
              }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Verifying with Blockchain..." : "Verify & Refresh Results"}
          </button>
        </div>

        {/* Winner Banner - Show when election is ended */}
        {isEnded && winner && (
          <div className="mb-12 relative overflow-hidden">
            <div className="bg-linear-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-2xl p-8 text-center shadow-2xl">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiLz48L3N2Zz4=')] opacity-50"></div>
              <div className="relative">
                <Trophy className="w-16 h-16 text-white mx-auto mb-4 drop-shadow-lg" />
                <h2 className="text-3xl font-bold text-white mb-2 drop-shadow">
                  🎉 Election Winner 🎉
                </h2>
                {winner.isTie ? (
                  <>
                    <p className="text-xl text-white/90 mb-4">It's a tie between {winner.tiedCandidates} candidates!</p>
                    <div className="flex flex-wrap justify-center gap-4">
                      {winner.names?.map((name: string, idx: number) => (
                        <div key={idx} className="bg-white/20 backdrop-blur rounded-xl px-6 py-3">
                          <p className="text-2xl font-bold text-white">{name}</p>
                          <p className="text-white/80">{winner.parties?.[idx]}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-bold text-white mb-2 drop-shadow">{winner.name}</p>
                    <p className="text-xl text-white/90 mb-4">{winner.party}</p>
                    <div className="inline-flex items-center gap-4 bg-white/20 backdrop-blur rounded-full px-6 py-3">
                      <span className="text-white font-bold">{winner.votes?.toLocaleString()} votes</span>
                      <span className="text-white/80">({winner.percentage}%)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total Votes Cast</p>
            <p className="text-3xl font-bold text-slate-900">{metadata.totalVotes.toLocaleString()}</p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Participating Candidates</p>
            <p className="text-3xl font-bold text-teal-600">{results.length}</p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Election Status</p>
            <p className="text-lg font-bold text-slate-900 flex items-center">
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${election?.state === 'Voting' ? 'bg-green-500' : 'bg-gray-400'
                }`}></span>
              {election?.state || "Unknown"}
            </p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Last Updated</p>
            <p className="text-sm font-mono text-slate-900">{metadata.lastUpdated.toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Main Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bar Chart */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Vote Distribution</h2>
              {results.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="votes" fill="#0f172a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-87.5 flex items-center justify-center text-gray-500">
                  No votes cast yet
                </div>
              )}
            </div>

            {/* Candidate Results Table */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Detailed Results</h2>
              <div className="space-y-6">
                {results.map((candidate, idx) => (
                  <div key={candidate.id || idx}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                        <p className="text-sm text-gray-600">{candidate.party}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{candidate.vote_count.toLocaleString()} votes</p>
                        <p className="text-sm text-teal-600 font-semibold">{candidate.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${candidate.percentage}%`,
                          backgroundColor: COLORS[idx % COLORS.length],
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No candidates found.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pie Chart */}
            <div className="ballot-card ballot-card-hover p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 text-center">Vote Share</h3>
              <div className="h-62.5">
                {results.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(1)}%` : ''}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="votes"
                      >
                        {results.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No data
                  </div>
                )}
              </div>
            </div>

            {/* Blockchain Status */}
            <div className="ballot-card ballot-card-hover p-6 border-l-4 border-teal-500">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Blockchain Status
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Contract Address</p>
                  <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all mt-1 text-gray-700">
                    {election?.contract_address || "Not Deployed"}
                  </code>
                </div>
                <div>
                  <p className="text-gray-600">Total Votes on Chain</p>
                  <p className="font-bold text-slate-900">{metadata.totalVotes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Network</p>
                  <p className="font-semibold text-teal-600">Sepolia Testnet</p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <a
                    href={`https://sepolia.etherscan.io/address/${election?.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline font-medium text-sm flex items-center gap-1"
                  >
                    View on Blockchain Explorer
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Auto-Refresh */}
            <div className="ballot-card ballot-card-hover p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium text-slate-900">Auto-refresh results</span>
              </label>
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                <RefreshCw className="w-3 h-3" />
                Updates every 10 seconds
              </p>
            </div>

            {/* Verification Badge */}
            <div className="ballot-card ballot-card-hover p-6 bg-linear-to-br from-teal-50 to-transparent border border-teal-200">
              <div className="flex justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-center mb-3">Verified Results</h3>
              <p className="text-xs text-center text-gray-600">
                All results are independently verified and immutably recorded on the blockchain.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="ballot-card ballot-card-hover p-6">
            <h3 className="font-bold text-slate-900 mb-3">Election Details</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <span className="font-medium">Voting Opens:</span> {election?.started_at ? new Date(election.started_at).toLocaleString() : 'Not Started'}
              </li>
              <li>
                <span className="font-medium">Voting Closes:</span> {election?.ended_at ? new Date(election.ended_at).toLocaleString() : 'TBD'}
              </li>
              <li>
                <span className="font-medium">Results Published:</span> Real-time
              </li>
            </ul>
          </div>

          <div className="ballot-card ballot-card-hover p-6">
            <h3 className="font-bold text-slate-900 mb-3">Transparency Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Real-time vote counting
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Blockchain verification
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                Cryptographic proof
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-linear-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-3">Haven't Voted Yet?</h2>
          <p className="mb-6 text-gray-100">Cast your vote securely and transparently. Your voice matters.</p>
          <Link
            href="/login"
            className="inline-block bg-amber-500 text-white hover:bg-amber-600 font-bold rounded-xl px-8 py-3 transition-colors"
          >
            Vote Now
          </Link>
        </div>
      </div>
    </div>
  )
}
