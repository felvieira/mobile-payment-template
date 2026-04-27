# Auth — NextAuth v5 + Google OAuth

## Setup

NextAuth v5 (beta) is configured in `src/lib/auth/index.ts`:

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      // Expose userId (token.sub) on the session
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub
      }
      return session
    },
  },
})
```

Route handler at `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

## Getting the current user

### Server component / API route
```ts
import { auth } from '@/lib/auth'

const session = await auth()
const userId = session?.user?.id   // Google user sub (stable identifier)
const email  = session?.user?.email
```

### Client component
```ts
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userId = (session?.user as any)?.id
```

## Env vars

```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
NEXTAUTH_SECRET=<openssl rand -base64 32>   # signs JWT cookies
NEXTAUTH_URL=https://yourapp.com            # must be your production URL
```

## Google Cloud Console setup (per app)

1. console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web application
3. Authorized JavaScript origins:
   - `https://yourapp.com`
   - `http://localhost:3000`
4. Authorized redirect URIs:
   - `https://yourapp.com/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID + Secret → set in env

## Tauri Android and OAuth

On Android, the OAuth flow opens the system browser (not the in-app WebView) via `tauri-plugin-shell`. After auth, Google redirects to `https://yourapp.com/api/auth/callback/google`. The page then redirects to your app via the deep link scheme `payment-hub://` (configured in `tauri.conf.json`).

If you're adding a "Sign in" button to the Tauri Android app:
```ts
import { signIn } from 'next-auth/react'
// Opens system browser for OAuth
await signIn('google', { callbackUrl: `${APP_CONFIG.deepLinkScheme}://auth-callback` })
```

## Connecting userId to payments

The current paywall uses `userId = 'demo-user'` as a placeholder. Replace it with the real session userId:

```tsx
// src/app/(mobile)/paywall/page.tsx
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userId = (session?.user as any)?.id ?? 'anonymous'
```

Pass `userId` to all payment calls. The `Subscription` and `IAPReceipt` models both have `userId` indexed for fast lookup.
