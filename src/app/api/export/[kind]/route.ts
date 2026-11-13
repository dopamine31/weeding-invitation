import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { db } from "@/db";
import * as s from "@/db/schema";
import { AccessError, requireEventAccess } from "@/server/auth";

export const dynamic = "force-dynamic";

const safe = (v: unknown): string => {
  const t = v === null || v === undefined ? "" : String(v);
  return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; // neutralise spreadsheet formula injection
};

function sheetBasics(ws: ExcelJS.Worksheet, widths?: number[]) {
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2B2A28" } };
  ws.columns.forEach((col, i) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (c) => { max = Math.max(max, String(c.value ?? "").length + 2); });
    col.width = widths?.[i] ?? Math.min(48, max);
  });
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const eventId = req.nextUrl.searchParams.get("eventId") ?? "";
  const subId = req.nextUrl.searchParams.get("sub");
  let access;
  try {
    access = await requireEventAccess(eventId, "VIEWER");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AccessError ? e.message : "forbidden" }, { status: 403 });
  }
  const { event, auth } = access;
  const [guests, groups, rsvps, subs, menus, seats, wishes] = await Promise.all([
    db.select().from(s.guests).where(eq(s.guests.eventId, eventId)).orderBy(asc(s.guests.name)),
    db.select().from(s.guestGroups).where(eq(s.guestGroups.eventId, eventId)),
    db.select().from(s.rsvps).where(eq(s.rsvps.eventId, eventId)),
    db.select().from(s.subEvents).where(eq(s.subEvents.eventId, eventId)).orderBy(asc(s.subEvents.sort)),
    db.select().from(s.menuOptions).where(eq(s.menuOptions.eventId, eventId)),
    db.select({ guestId: s.seatAssignments.guestId, table: s.tables.name }).from(s.seatAssignments).innerJoin(s.tables, eq(s.tables.id, s.seatAssignments.tableId)).where(eq(s.seatAssignments.eventId, eventId)),
    db.select().from(s.wishes).where(eq(s.wishes.eventId, eventId)).orderBy(asc(s.wishes.createdAt)),
  ]);
  const gName = new Map(groups.map((g) => [g.id, g.name]));
  const mName = new Map(menus.map((m) => [m.id, m.name]));
  const sName = new Map(subs.map((x) => [x.id, x.name]));
  const seatBy = new Map(seats.map((x) => [x.guestId, x.table]));
  const guestBy = new Map(guests.map((g) => [g.id, g]));
  const file = (name: string) => `${event.slug}-${name}`;
  const csv = (rows: Record<string, unknown>[], name: string) =>
    new NextResponse("\uFEFF" + Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)])))), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file(name)}"` } });
  const xlsx = async (wb: ExcelJS.Workbook, name: string) => new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${file(name)}"` } });

  const guestRows = guests.map((g) => ({ Nama: g.name, Telepon: g.phone ?? "", Email: g.email ?? "", Grup: g.groupId ? gName.get(g.groupId) ?? "" : "", Kategori: g.category, "Maks Pax": g.maxPax, Meja: seatBy.get(g.id) ?? "", Catatan: g.notes }));

  if (kind === "guests.csv") {
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "export.guests", target: eventId });
    return csv(guestRows, "tamu.csv");
  }
  if (kind === "guests.xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tamu");
    ws.columns = Object.keys(guestRows[0] ?? { Nama: "" }).map((k) => ({ header: k, key: k }));
    guestRows.forEach((r) => ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)]))));
    sheetBasics(ws);
    return xlsx(wb, "tamu.xlsx");
  }
  if (kind === "rsvp.csv") {
    return csv(rsvps.map((r) => ({ Tamu: guestBy.get(r.guestId)?.name ?? "", Acara: sName.get(r.subEventId) ?? "", Status: r.status, Pax: r.pax, Menu: r.menuId ? mName.get(r.menuId) ?? "" : "", Alergi: r.allergy, Tingkat: r.severity, Diperbarui: r.updatedAt.toISOString() })), "rsvp.csv");
  }
  if (kind === "wishes.csv") {
    return csv(wishes.map((w) => ({ Nama: w.name, Ucapan: w.message, Status: w.status, Disematkan: w.pinned ? "ya" : "", Balasan: w.reply ?? "", Waktu: w.createdAt.toISOString() })), "ucapan.csv");
  }
  if (kind === "all.json") {
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "export.all", target: eventId });
    const body = JSON.stringify({ event: { ...event, password: undefined, staffPinHash: undefined, tvKey: undefined }, subEvents: subs, guests, rsvps, wishes, menus, tables: seats }, null, 2);
    return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${file("semua-data.json")}"` } });
  }
  if (kind === "catering.xlsx") {
    // one row per attending guest (highest pax when several sub-events), optionally filtered per sub-event
    const attending = new Map<string, (typeof rsvps)[number]>();
    for (const r of rsvps) {
      if (r.status !== "attending" || (subId && r.subEventId !== subId)) continue;
      const cur = attending.get(r.guestId);
      if (!cur || r.pax > cur.pax) attending.set(r.guestId, r);
    }
    const list = [...attending.values()].map((r) => ({ r, g: guestBy.get(r.guestId) })).filter((x): x is { r: (typeof rsvps)[number]; g: (typeof guests)[number] } => !!x.g);
    const menuNames = [...menus.map((m) => m.name), "(Belum memilih)"];
    const menuOf = (r: (typeof rsvps)[number]) => (r.menuId ? mName.get(r.menuId) ?? "(Belum memilih)" : "(Belum memilih)");
    const wb = new ExcelJS.Workbook();
    wb.creator = "WeddingOS";
    const sum = wb.addWorksheet("Ringkasan");
    sum.columns = [{ header: "Menu", key: "m" }, { header: "Total Pax", key: "n" }];
    let total = 0;
    for (const m of menuNames) {
      const n = list.filter((x) => menuOf(x.r) === m).reduce((a, x) => a + x.r.pax, 0);
      total += n;
      sum.addRow({ m, n });
    }
    const tr = sum.addRow({ m: "TOTAL", n: total });
    tr.font = { bold: true };
    sheetBasics(sum);
    const pm = wb.addWorksheet("Per Meja");
    pm.columns = [{ header: "Meja", key: "t" }, ...menuNames.map((m) => ({ header: m, key: m })), { header: "Total", key: "tot" }];
    const tables = [...new Set([...seats.map((x) => x.table), "(Belum duduk)"])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const t of tables) {
      const inT = list.filter((x) => (seatBy.get(x.g.id) ?? "(Belum duduk)") === t);
      if (!inT.length) continue;
      const row: Record<string, unknown> = { t };
      let tot = 0;
      for (const m of menuNames) { const n = inT.filter((x) => menuOf(x.r) === m).reduce((a, x) => a + x.r.pax, 0); row[m] = n; tot += n; }
      row.tot = tot;
      pm.addRow(row);
    }
    sheetBasics(pm);
    const al = wb.addWorksheet("Alergi & Diet");
    al.columns = [{ header: "Nama", key: "n" }, { header: "Meja", key: "t" }, { header: "Alergi / Diet", key: "a" }, { header: "Tingkat", key: "s" }, { header: "Catatan", key: "c" }];
    for (const x of list.filter((y) => y.r.allergy)) {
      const row = al.addRow({ n: safe(x.g.name), t: seatBy.get(x.g.id) ?? "", a: safe(x.r.allergy), s: x.r.severity, c: safe(x.g.notes) });
      if (x.r.severity === "SEVERE") row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
      else row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    }
    sheetBasics(al);
    const dl = wb.addWorksheet("Daftar Tamu");
    dl.columns = [{ header: "Nama", key: "n" }, { header: "Acara", key: "e" }, { header: "Pax", key: "p" }, { header: "Menu", key: "m" }, { header: "Meja", key: "t" }, { header: "Alergi", key: "a" }];
    for (const x of list) dl.addRow({ n: safe(x.g.name), e: sName.get(x.r.subEventId) ?? "", p: x.r.pax, m: menuOf(x.r), t: seatBy.get(x.g.id) ?? "", a: safe(x.r.allergy) });
    sheetBasics(dl);
    await db.insert(s.auditLogs).values({ actorId: auth.user.id, action: "export.catering", target: eventId });
    return xlsx(wb, "catering.xlsx");
  }
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
void and;
