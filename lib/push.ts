import webPush from "web-push";

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: Record<string, unknown>
) {
  return webPush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    },
    JSON.stringify(payload)
  );
}
