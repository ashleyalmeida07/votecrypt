"use client"
import { useState } from "react"
import type React from "react"

import { Shield, BarChart3, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function AdminPanel() {
  const [electionState, setElectionState] = useState<"not_started" | "active" | "paused" | "closed">("active")
  const [showFinalResults, setShowFinalResults] = useState(false)
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminPassword === "admin123") {
      setAdminAuthenticated(true)
    } else {
      alert("Invalid password")
    }
  }

  const voteTimestampData = [
    { time: "8:00 AM", votes: 0 },
    { time: "9:00 AM", votes: 450 },
    { time: "10:00 AM", votes: 1230 },
    { time: "11:00 AM", votes: 2100 },
    { time: "12:00 PM", votes: 3450 },
    { time: "1:00 PM", votes: 5600 },
    { time: "2:00 PM", votes: 8900 },
    { time: "3:00 PM", votes: 10000 },
  ]

  if (!adminAuthenticated) {
    return <AdminLoginPage onLogin={handleLogin} password={adminPassword} setPassword={setAdminPassword} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="ballot-container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">BALLOT Admin Panel</h1>
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
          <AlertCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-slate-900">Restricted Access</h3>
            <p className="text-sm text-gray-600">
              This panel is for election authorities only. All actions are logged and audited.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          {/* Election Status */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Election Status</p>
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${electionState === "active" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
              ></div>
              <p className="text-lg font-bold text-slate-900 capitalize">{electionState}</p>
            </div>
            <select
              value={electionState}
              onChange={(e) => setElectionState(e.target.value as any)}
              className="w-full ballot-input text-sm"
            >
              <option value="not_started">Not Started</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Total Votes */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total Votes Cast</p>
            <p className="text-3xl font-bold text-slate-900">10,000</p>
            <p className="text-xs text-gray-500 mt-2">In last 24 hours</p>
          </div>

          {/* Verified Voters */}
          <div className="ballot-card ballot-card-hover p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Verified Voters</p>
            <p className="text-3xl font-bold text-teal-600">14,847</p>
            <p className="text-xs text-gray-500 mt-2">67.4% turnout</p>
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
              <h2 className="text-xl font-bold text-slate-900 mb-6">Vote Count Timeline</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={voteTimestampData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line type="monotone" dataKey="votes" stroke="#0f172a" strokeWidth={2} dot={{ fill: "#14b8a6" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Candidate Vote Breakdown */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Current Vote Distribution</h2>
              <div className="space-y-6">
                {[
                  { name: "Alice Johnson", votes: 4230, party: "Democratic Party" },
                  { name: "Robert Chen", votes: 3890, party: "Republican Party" },
                  { name: "Maria Garcia", votes: 1880, party: "Independent" },
                ].map((candidate, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                        <p className="text-xs text-gray-600">{candidate.party}</p>
                      </div>
                      <p className="font-bold text-slate-900">{candidate.votes} votes</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(candidate.votes / 10000) * 100}%`,
                          backgroundColor: idx === 0 ? "#0f172a" : idx === 1 ? "#14b8a6" : "#f59e0b",
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Statistics */}
            <div className="ballot-card ballot-card-hover p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Verification Statistics</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { label: "Successful Verifications", value: "14,847", icon: CheckCircle, color: "green" },
                  { label: "Failed Verification Attempts", value: "1,256", icon: AlertCircle, color: "red" },
                  { label: "Average Verification Time", value: "2.3s", icon: Clock, color: "blue" },
                  { label: "Blockchain Confirmations", value: "99.8%", icon: CheckCircle, color: "green" },
                ].map((stat, idx) => {
                  const Icon = stat.icon
                  return (
                    <div key={idx} className="p-4 bg-slate-100 rounded-xl border border-gray-200">
                      <div className="flex items-start gap-3">
                      <Icon className="w-5 h-5 text-teal-600 shrink-0 mt-1" />
                        <div>
                          <p className="text-xs text-gray-600 mb-1">{stat.label}</p>
                          <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Election Control */}
            <div className="ballot-card ballot-card-hover p-6">
              <h3 className="font-bold text-slate-900 mb-4">Election Control</h3>
              <div className="space-y-3">
                {[
                  { label: "Start Election", enabled: electionState === "not_started" },
                  { label: "End Election", enabled: electionState === "active" },
                  { label: "Pause Election", enabled: electionState === "active" },
                  { label: "Resume Election", enabled: electionState === "paused" },
                ].map((action, idx) => (
                  <button
                    key={idx}
                    disabled={!action.enabled}
                    className={`w-full px-4 py-2 rounded-xl font-medium transition-colors ${
                      action.enabled
                        ? "ballot-primary-btn hover:opacity-90"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Contract Info */}
            <div className="ballot-card ballot-card-hover p-6 border-l-4 border-teal-500">
              <h3 className="font-bold text-slate-900 mb-4">Smart Contract Status</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Contract Address</p>
                  <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all mt-1 text-gray-700">
                    0x4a9c8f...2e3d4b
                  </code>
                </div>
                <div>
                  <p className="text-gray-600">Network</p>
                  <p className="font-semibold text-teal-600">Ethereum Mainnet</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Active
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Actions */}
            <div className="ballot-card ballot-card-hover p-6">
              <h3 className="font-bold text-slate-900 mb-4">Recent Actions</h3>
              <div className="space-y-3 text-sm">
                {["Election started", "Results page enabled", "Verification system online", "First vote received"].map(
                  (action, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </div>
                  ),
                )}
              </div>
            </div>

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
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
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
