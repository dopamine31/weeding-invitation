import { sql } from "drizzle-orm";
import { db } from "@/db";

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows;
}

export interface Stats {
  invited: number; sent: number; opened: number; rsvped: number; attending: number; declined: number; totalPax: number; notRsvp: number; checkedIn: number;
  daily: { day: string; n: number }[];
  menus: { name: string; pax: number }[];
  allergies: number;
  recent: { name: string; status: string; at: string }[];
  wishesPending: number;
}

export async function getStats(eventId: string): Promise<Stats> {
  const [c] = await rows<{ invited: number; sent: number; opened: number; rsvped: number; attending: number; declined: number; pax: number; checked: number; allergies: number; pending: number }>(sql`
    select
      (select count(*)::int from guests where event_id = ${eventId}) as invited,
      (select count(distinct guest_id)::int from blast_messages where event_id = ${eventId} and status in ('SENT','DELIVERED','READ')) as sent,
      (select count(distinct guest_id)::int from link_opens where event_id = ${eventId}) as opened,
      (select count(distinct guest_id)::int from rsvps where event_id = ${eventId}) as rsvped,
      (select count(distinct guest_id)::int from rsvps where event_id = ${eventId} and status = 'attending') as attending,
      (select count(distinct guest_id)::int from rsvps where event_id = ${eventId} and status = 'declined') as declined,
      (select coalesce(sum(p),0)::int from (select max(pax) p from rsvps where event_id = ${eventId} and status='attending' group by guest_id) x) as pax,
      (select count(distinct guest_id)::int from check_ins where event_id = ${eventId} and guest_id is not null) as checked,
      (select count(*)::int from rsvps where event_id = ${eventId} and allergy <> '') as allergies,
      (select count(*)::int from wishes where event_id = ${eventId} and status in ('PENDING','FLAGGED')) as pending`);
  const daily = await rows<{ day: string; n: number }>(sql`select to_char(date_trunc('day', created_at), 'DD Mon') as day, count(*)::int as n from rsvps where event_id = ${eventId} and created_at > now() - interval '14 days' group by date_trunc('day', created_at) order by date_trunc('day', created_at)`);
  const menus = await rows<{ name: string; pax: number }>(sql`select m.name as name, coalesce(sum(r.pax),0)::int as pax from rsvps r join menu_options m on m.id = r.menu_id where r.event_id = ${eventId} and r.status='attending' group by m.name order by pax desc`);
  const recent = await rows<{ name: string; status: string; at: string }>(sql`select g.name as name, r.status as status, to_char(r.updated_at, 'DD Mon HH24:MI') as at from rsvps r join guests g on g.id = r.guest_id where r.event_id = ${eventId} order by r.updated_at desc limit 6`);
  const v = c ?? { invited: 0, sent: 0, opened: 0, rsvped: 0, attending: 0, declined: 0, pax: 0, checked: 0, allergies: 0, pending: 0 };
  return { invited: v.invited, sent: v.sent, opened: v.opened, rsvped: v.rsvped, attending: v.attending, declined: v.declined, totalPax: v.pax, notRsvp: Math.max(0, v.invited - v.rsvped), checkedIn: v.checked, daily, menus, allergies: v.allergies, recent, wishesPending: v.pending };
}
