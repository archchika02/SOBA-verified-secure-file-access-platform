import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?sso_error=${encodeURIComponent(error)}`, request.url));
  }

  if (!token) {
    return NextResponse.redirect(new URL('/?sso_error=Missing_Bridge_Token', request.url));
  }

  // Set the token as a secure cookie in our application
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('soba_access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600 * 24 // 1 day
  });

  return response;
}
