import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware protects routes by checking if user is authenticated
export function middleware(request: NextRequest) {
  // For now, just allow all requests through
  // The actual protection is done on the client side in each protected page
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/verify-phone/:path*',
    '/verify-face/:path*',
    '/results/:path*',
    '/admin/:path*'
  ],
};
