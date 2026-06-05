import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL(`/?sso_error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?sso_error=Missing_Authorization_Code', request.url));
  }

  const tokenUrl = process.env.SOBA_TOKEN_URL;
  const clientId = process.env.SOBA_CLIENT_ID;
  const clientSecret = process.env.SOBA_CLIENT_SECRET;
  const redirectUri = process.env.SOBA_REDIRECT_URI;

  try {
    // Exchange Authorization Code for Access Token
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirectUri: redirectUri // redirect_uri
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to exchange code for token:', errText);
      return NextResponse.redirect(new URL('/?sso_error=Token_Exchange_Failed', request.url));
    }

    const data = await response.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/?sso_error=Missing_Access_Token', request.url));
    }

    // Set secure, HttpOnly cookie containing the access token
    const callbackResponse = NextResponse.redirect(new URL('/', request.url));
    
    callbackResponse.cookies.set('soba_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: data.expires_in || 3600 // Expiration time in seconds
    });

    return callbackResponse;

  } catch (err) {
    console.error('Error during token exchange:', err);
    return NextResponse.redirect(new URL('/?sso_error=Internal_Exchange_Error', request.url));
  }
}
