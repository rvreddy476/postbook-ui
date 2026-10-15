/*
  The one Firebase call web push needs: an FCM registration token for our own
  service worker registration. Loaded with a dynamic import from browser.ts,
  so the SDK is fetched only when push is being turned on or refreshed.

  The registration is passed in, so Firebase never registers its default
  /firebase-messaging-sw.js. deleteToken() is deliberately not used: without
  that default worker it would register one. Turning push off drops the push
  subscription instead (client.ts), after which getToken() mints a new token
  and asks FCM to delete the old one.
*/

import { getApps, initializeApp } from "firebase/app"
import { getMessaging, getToken, isSupported } from "firebase/messaging"

import type { WebPushConfig } from "./config"

const APP_NAME = "momentum-web-push"

export async function firebaseToken(config: WebPushConfig, registration: ServiceWorkerRegistration): Promise<string | null> {
    if (!(await isSupported())) return null
    const app =
        getApps().find((a) => a.name === APP_NAME) ??
        initializeApp(
            {
                apiKey: config.apiKey,
                projectId: config.projectId,
                messagingSenderId: config.messagingSenderId,
                appId: config.appId,
            },
            APP_NAME,
        )
    const token = await getToken(getMessaging(app), {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
    })
    return token || null
}
