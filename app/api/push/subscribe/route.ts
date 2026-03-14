import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type Body = {
  subscription: PushSubscription;
  settings: {
    intervalMinutes: number;
    startHour: number;
    endHour: number;
    timezone: string;
    enabled: boolean;
  };
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const sub = body.subscription;
  const endpoint = sub.endpoint;
  const p256dh = sub.toJSON().keys?.p256dh;
  const auth = sub.toJSON().keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  const s = body.settings;

  await sql`
    insert into subscriptions (endpoint, p256dh, auth)
    values (${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint)
    do update set
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `;

  await sql`
    insert into reminder_settings (
      endpoint, interval_minutes, start_hour, end_hour, timezone, enabled
    )
    values (
      ${endpoint},
      ${s.intervalMinutes},
      ${s.startHour},
      ${s.endHour},
      ${s.timezone},
      ${s.enabled}
    )
    on conflict (endpoint)
    do update set
      interval_minutes = excluded.interval_minutes,
      start_hour = excluded.start_hour,
      end_hour = excluded.end_hour,
      timezone = excluded.timezone,
      enabled = excluded.enabled
  `;

  return NextResponse.json({ ok: true });
}
