// Shared OTP storage (in production, use Redis or database)
export const otpStorage = new Map<string, { otp: string; expiresAt: number }>();
