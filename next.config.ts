import type { NextConfig } from 'next'

const isTauri = process.env.NEXT_PUBLIC_TARGET === 'tauri'

const config: NextConfig = {
  output: isTauri ? 'export' : undefined,
  images: { unoptimized: isTauri },
  trailingSlash: isTauri,
}

export default config
