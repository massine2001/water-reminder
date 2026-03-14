import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendWebPush } from "@/lib/push";

type Row = {
  endpoint: string;
  p256dh: string;
  auth: string;
  interval_minutes: number;
  start_hour: number;
  end_hour: number;
  timezone: string;
  enabled: boolean;
  last_sent_at: string | null;
};

function shouldSendNow(row: Row, nowUtc: Date) {
  if (!row.enabled) return false;

  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: row.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(nowUtc);

  const hour = Number(local.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(local.find((p) => p.type === "minute")?.value ?? "0");

  if (hour < row.start_hour || hour >= row.end_hour) return false;

  const totalMinutes = hour * 60 + minute;
  if (totalMinutes % row.interval_minutes !== 0) return false;

  if (!row.last_sent_at) return true;

  const diffMs = nowUtc.getTime() - new Date(row.last_sent_at).getTime();
  return diffMs >= row.interval_minutes * 60 * 1000 - 30_000;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = (await sql`
    select
      s.endpoint,
      s.p256dh,
      s.auth,
      r.interval_minutes,
      r.start_hour,
      r.end_hour,
      r.timezone,
      r.enabled,
      r.last_sent_at
    from subscriptions s
    join reminder_settings r on r.endpoint = s.endpoint
    where r.enabled = true
  `) as Row[];

  const now = new Date();
  let sent = 0;

  for (const row of rows) {
    if (!shouldSendNow(row, now)) continue;

    try {
      await sendWebPush(
        {
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
        },
        {
          title: "Bois un verre d’eau",
          body: "Petit rappel hydratation 💧",
          url: "/",
        }
      );

      await sql`
        update reminder_settings
        set last_sent_at = now()
        where endpoint = ${row.endpoint}
      `;

      sent++;
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await sql`delete from subscriptions where endpoint = ${row.endpoint}`;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
