import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createOtpTable, storeOtp } from '@/lib/db-otp';

// Configure Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Ensure OTP table exists and store OTP with 5 minute expiration
    const sessionId = `${email}_${Date.now()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    
    await createOtpTable();
    
    // This will check for duplicates and skip if OTP was sent recently
    const stored = await storeOtp(sessionId, email, otp, expiresAt);
    
    // If storeOtp returned early due to duplicate, don't send email
    if (stored === false) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code' },
        { status: 429 }
      );
    }
    
    // Send email with OTP
    try {
      await transporter.sendMail({
        from: `"VoteCrypt" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your VoteCrypt Verification Code',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #0f172a;
                  background-color: #f8fafc;
                  padding: 40px 20px;
                }
                .container { 
                  max-width: 560px;
                  margin: 0 auto;
                  background: white;
                  border-radius: 0.75rem;
                  border: 1px solid #e2e8f0;
                  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
                }
                .header {
                  padding: 32px 32px 24px;
                  border-bottom: 1px solid #e2e8f0;
                }
                .brand {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                }
                .brand-icon {
                  width: 32px;
                  height: 32px;
                  background: #14b8a6;
                  border-radius: 0.5rem;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 18px;
                }
                .brand-name {
                  font-size: 20px;
                  font-weight: 600;
                  color: #0f172a;
                  letter-spacing: -0.025em;
                }
                .subtitle {
                  font-size: 14px;
                  color: #64748b;
                  margin: 0;
                }
                .content {
                  padding: 32px;
                }
                .title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #0f172a;
                  margin-bottom: 8px;
                  letter-spacing: -0.025em;
                }
                .description {
                  font-size: 14px;
                  color: #475569;
                  margin-bottom: 24px;
                }
                .otp-card {
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 0.5rem;
                  padding: 24px;
                  text-align: center;
                  margin: 24px 0;
                }
                .otp-label {
                  font-size: 12px;
                  font-weight: 500;
                  color: #64748b;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  margin-bottom: 12px;
                }
                .otp-code {
                  font-size: 36px;
                  font-weight: 700;
                  color: #0f172a;
                  letter-spacing: 0.25em;
                  font-family: 'Courier New', monospace;
                  margin: 8px 0;
                }
                .alert {
                  background: #fef3c7;
                  border: 1px solid #fde68a;
                  border-radius: 0.5rem;
                  padding: 12px 16px;
                  margin: 24px 0;
                }
                .alert-text {
                  font-size: 13px;
                  color: #92400e;
                  margin: 0;
                }
                .info-text {
                  font-size: 14px;
                  color: #64748b;
                  margin: 16px 0 0;
                }
                .footer {
                  padding: 24px 32px;
                  border-top: 1px solid #e2e8f0;
                  background: #f8fafc;
                  border-radius: 0 0 0.75rem 0.75rem;
                }
                .footer-text {
                  font-size: 12px;
                  color: #94a3b8;
                  text-align: center;
                  margin: 4px 0;
                }
                .footer-link {
                  color: #14b8a6;
                  text-decoration: none;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="brand">
                    <div class="brand-icon">🗳️</div>
                    <span class="brand-name">VoteCrypt</span>
                  </div>
                  <p class="subtitle">Secure Blockchain Voting Platform</p>
                </div>
                
                <div class="content">
                  <h1 class="title">Verify Your Email Address</h1>
                  <p class="description">
                    To complete your registration and secure your voting account, please use the verification code below.
                  </p>
                  
                  <div class="otp-card">
                    <div class="otp-label">Your Verification Code</div>
                    <div class="otp-code">${otp}</div>
                  </div>
                  
                  <div class="alert">
                    <p class="alert-text">
                      ⚠️ This code will expire in 5 minutes for security purposes.
                    </p>
                  </div>
                  
                  <p class="info-text">
                    If you didn't request this verification code, you can safely ignore this email. Your account remains secure.
                  </p>
                </div>
                
                <div class="footer">
                  <p class="footer-text">© 2026 VoteCrypt. All rights reserved.</p>
                  <p class="footer-text">
                    This is an automated message, please do not reply.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'OTP sent to your email',
      // Remove this in production! Only for testing
      devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
