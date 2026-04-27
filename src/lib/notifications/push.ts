import admin from 'firebase-admin'

let initializedApp: admin.app.App | null = null

function getApp(): admin.app.App {
  if (initializedApp) return initializedApp
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('FCM_SERVICE_ACCOUNT_JSON not set')
  initializedApp = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(json) as admin.ServiceAccount),
  })
  return initializedApp
}

export async function sendPush(input: {
  deviceToken: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<string> {
  return getApp().messaging().send({
    token: input.deviceToken,
    notification: { title: input.title, body: input.body },
    data: input.data,
  })
}
