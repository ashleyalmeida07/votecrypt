"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Shield, RefreshCw, CheckCircle, BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

export default function ResultsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setLastUpdated(new Date())
    }, 10000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const candidateResults = [
    { name: "Alice Johnson", votes: 4230, percentage: 42.3, party: "Democratic Party" },
    { name: "Robert Chen", votes: 3890, percentage: 38.9, party: "Republican Party" },
    { name: "Maria Garcia", votes: 1880, percentage: 18.8, party: "Independent" },
  ]

  const totalVotes = candidateResults.reduce((sum, c) => sum + c.votes, 0)

  const chartData = candidateResults.map((candidate) => ({
    name: candidate.name,
    votes: candidate.votes,
  }))

  const COLORS = ["#0f172a", "#14b8a6", "#f59e0b"]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="ballot-container flex items-center justify-between py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-900 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold">BALLOT</span>
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
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Live Election Results</h1>
          <p className="text-gray-600 text-lg">
            Presidential Election 2025 - Results updated in real-time from the blockchain
          </p>
        </div>

        {/* Top Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total Votes Cast</p>
            <p className="text-3xl font-bold text-slate-900">{totalVotes.toLocaleString()}</p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Voter Turnout</p>
            <p className="text-3xl font-bold text-teal-600">67.4%</p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Election Status</p>
            <p className="text-lg font-bold text-slate-900">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Active
            </p>
          </div>
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Last Updated</p>
            <p className="text-sm font-mono text-slate-900">{lastUpdated.toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Main Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bar Chart */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Vote Distribution</h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" />
                  <YAxis />
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
            </div>

            {/* Candidate Results Table */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Detailed Results</h2>
              <div className="space-y-6">
                {candidateResults.map((candidate, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                        <p className="text-sm text-gray-600">{candidate.party}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{candidate.votes.toLocaleString()} votes</p>
                        <p className="text-sm text-teal-600 font-semibold">{candidate.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${candidate.percentage}%`,
                          backgroundColor: COLORS[idx],
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pie Chart */}
            <div className="ballot-card ballot-card-hover p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6 text-center">Vote Share</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="votes"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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
                    0x4a9c8f...2e3d4b
                  </code>
                </div>
                <div>
                  <p className="text-gray-600">Total Votes on Chain</p>
                  <p className="font-bold text-slate-900">{totalVotes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600">Network</p>
                  <p className="font-semibold text-teal-600">Ethereum Mainnet</p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <a href="#" className="text-teal-600 hover:underline font-medium text-sm flex items-center gap-1">
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
            <div className="ballot-card ballot-card-hover p-6 bg-gradient-to-br from-teal-50 to-transparent border border-teal-200">
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
                <span className="font-medium">Voting Opens:</span> March 15, 2025 8:00 AM
              </li>
              <li>
                <span className="font-medium">Voting Closes:</span> March 15, 2025 8:00 PM
              </li>
              <li>
                <span className="font-medium">Results Published:</span> March 16, 2025 12:00 AM
              </li>
            </ul>
          </div>

          <div className="ballot-card ballot-card-hover p-6">
            <h3 className="font-bold text-slate-900 mb-3">Transparency Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Real-time vote counting
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Blockchain verification
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Cryptographic proof
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-8 text-center">
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
