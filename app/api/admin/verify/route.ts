import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', isAuthorized: false },
        { status: 400 }
      )
    }

    // Check if email exists in admin_users table
    const result = await sql`
      SELECT id, email, display_name, is_active 
      FROM admin_users 
      WHERE email = ${email} AND is_active = true
    `

    if (result.rows.length > 0) {
      return NextResponse.json({
        isAuthorized: true,
        admin: result.rows[0]
      })
    }

    return NextResponse.json({
      isAuthorized: false,
      message: 'Access denied. Your account is not authorized to access the admin panel.'
    })

  } catch (error) {
    console.error('Error verifying admin:', error)
    return NextResponse.json(
      { error: 'Failed to verify admin access', isAuthorized: false },
      { status: 500 }
    )
  }
}
