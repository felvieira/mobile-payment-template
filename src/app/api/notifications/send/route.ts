import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendPush } from '@/lib/notifications/push'

const Schema = z.object({
  deviceToken: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.NOTIFICATIONS_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const parsed = Schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const messageId = await sendPush(parsed.data)
  return NextResponse.json({ messageId })
}
