'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Shield, Activity, Lock, Database, RefreshCcw, ExternalLink, CheckCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VoteTransaction {
    id: number
    hash: string // Nullifier hash
    timestamp: string
    txHash?: string // Optional on-chain tx
}

interface ElectionStats {
    totalVotes: number
    totalVoters: number // Registered
}

interface IntegrityData {
    merkleRoot: string | null
    lastUpdated: string | null
}

interface AuditData {
    active: boolean
    election: {
        id: number
        name: string
        state: string
        contractAddress?: string
    }
    stats: ElectionStats
    integrity: IntegrityData
    recentVotes: VoteTransaction[]
    candidates: any[]
}

export default function AuditDashboard() {
    const [data, setData] = useState<AuditData | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

    // Polling setup
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/audit/live')
                const json = await res.json()
                setData(json)
                setLastRefreshed(new Date())
                setLoading(false)
            } catch (error) {
                console.error('Audit fetch error:', error)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 3000) // Poll every 3 seconds
        return () => clearInterval(interval)
    }, [])

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                    <p className="text-teal-500 font-mono animate-pulse">CONNECTING TO SECURE NODE...</p>
                </div>
            </div>
        )
    }

    if (!data?.active) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <Shield className="w-16 h-16 text-gray-600 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">No Active Election</h1>
                <p className="text-gray-400">The audit system is in standby mode.</p>
                <Link href="/" className="mt-8 text-teal-500 hover:text-teal-400">Return Home</Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white font-mono selection:bg-teal-500/30">
            {/* Header / Status Bar */}
            <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <img src="/favicon.svg" alt="VoteCrypt Logo" className="w-8 h-8" />
                            <span className="font-bold tracking-wider">VoteCrypt.AUDIT</span>
                        </Link>
                        <span className="px-2 py-0.5 rounded text-xs bg-teal-500/10 text-teal-500 border border-teal-500/20">
                            LIVE SYSTEM
                        </span>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span>{data.election.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span>Updated: {lastRefreshed.toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 space-y-6">

                {/* Top Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Total Votes Card */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Activity className="w-16 h-16 text-teal-500" />
                        </div>
                        <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-1">Total Votes Cast</h3>
                        <div className="text-4xl font-bold text-white flex items-end gap-2">
                            {data.stats.totalVotes}
                            <span className="text-sm font-normal text-teal-500 mb-1">
                                {data.stats.totalVoters > 0 ?
                                    `(${((data.stats.totalVotes / data.stats.totalVoters) * 100).toFixed(1)}% Turnout)` : ''}
                            </span>
                        </div>
                        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-teal-500 transition-all duration-1000 ease-out"
                                style={{ width: `${Math.min(((data.stats.totalVotes / (data.stats.totalVoters || 1)) * 100), 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Election Status */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
                        <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-1">System State</h3>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {data.election.state}
                            {data.election.state === 'Voting' && (
                                <span className="inline-flex w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            ID: #{data.election.id} • ZERO KNOWLEDGE MODE
                        </p>
                    </div>

                    {/* Registered Voters */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
                        <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-1">Registered Voters</h3>
                        <div className="text-3xl font-bold text-white">
                            {data.stats.totalVoters}
                        </div>
                        <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Fully Anonymized
                        </p>
                    </div>

                    {/* Integrity Status */}
                    <div className="bg-slate-900/50 border border-teal-900/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-linear-to-br from-teal-500/5 to-transparent"></div>
                        <h3 className="text-teal-500 text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Integrity Check
                        </h3>
                        <div className="space-y-2 mt-3">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Current Merkle Root</p>
                                <p className="text-xs font-mono text-gray-300 truncate font-medium">
                                    {data.integrity.merkleRoot ? data.integrity.merkleRoot : 'Waiting for votes...'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase">Smart Contract</p>
                                <a
                                    href={`https://sepolia.etherscan.io/address/${data.election.contractAddress}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-mono text-teal-400 hover:underline flex items-center gap-1 truncate"
                                >
                                    {data.election.contractAddress || 'Not Deployed'}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Feed: Live Votes */}
                    <div className="lg:col-span-2 bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden flex flex-col h-150">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Database className="w-4 h-4 text-teal-500" />
                                Live Vote Transactions
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Real-time Feed
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <AnimatePresence initial={false}>
                                {data.recentVotes.map((vote) => (
                                    <motion.div
                                        key={vote.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="bg-black/40 border border-white/5 p-3 rounded-lg hover:border-teal-500/30 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-teal-500">VOTE CAST</span>
                                                    <span className="text-[10px] text-gray-500 font-mono">
                                                        {new Date(vote.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="font-mono text-xs text-gray-300">
                                                    <span className="text-gray-600">NULLIFIER:</span>
                                                    <span className="ml-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        {vote.hash.slice(0, 10)}...{vote.hash.slice(-10)}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* ZKP Badge */}
                                            <div className="px-2 py-1 rounded bg-teal-900/20 border border-teal-900/50 text-[10px] text-teal-400 font-bold">
                                                ZKP VERIFIED
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {data.recentVotes.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                                    <Activity className="w-12 h-12 mb-2" />
                                    <p>Waiting for incoming votes...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar: Candidate Status (Anonymized or Aggregate) */}
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden h-150 flex flex-col">
                        <div className="p-4 border-b border-white/10 bg-white/5">
                            <h3 className="text-white font-bold">Candidate Standings</h3>
                            <p className="text-xs text-gray-500 mt-1">Live aggregated counts</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {data.candidates.map((candidate, idx) => {
                                // Calculate percentage
                                const percent = data.stats.totalVotes > 0
                                    ? ((candidate.vote_count / data.stats.totalVotes) * 100)
                                    : 0

                                return (
                                    <div key={candidate.id} className="relative">
                                        <div className="flex justify-between items-end mb-1">
                                            <div>
                                                <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                                                <h4 className="text-sm font-bold text-white">{candidate.name}</h4>
                                                <p className="text-[10px] text-gray-500">{candidate.party}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-teal-500">{candidate.vote_count}</span>
                                                <span className="text-xs text-gray-500 ml-1">votes</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${percent}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className="h-full bg-linear-to-r from-teal-500 to-blue-500 rounded-full"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="p-4 border-t border-white/10 text-xs text-gray-500 text-center">
                            Results are verified on-chain
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
