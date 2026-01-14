import { NextResponse } from 'next/server'
import { initDatabase } from '@/lib/db'

// POST: Initialize database tables
export async function POST() {
    try {
        const success = await initDatabase()

        if (success) {
            return NextResponse.json({
                success: true,
                message: 'Database tables initialized successfully',
            })
        } else {
            return NextResponse.json({
                success: false,
                error: 'Failed to initialize database',
            }, { status: 500 })
        }
    } catch (error: any) {
        console.error('Database init error:', error)
        return NextResponse.json({
            success: false,
            error: error.message || 'Database connection failed',
        }, { status: 500 })
    }
}

// GET: Check database connection
export async function GET() {
    try {
        const { sql } = await import('@/lib/db')
        const result = await sql`SELECT NOW() as time`

        return NextResponse.json({
            connected: true,
            serverTime: result[0].time,
            message: 'Database connection successful',
        })
    } catch (error: any) {
        return NextResponse.json({
            connected: false,
            error: error.message,
        }, { status: 500 })
    }
}
