"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { addGuest, commitImport, deleteGuests, parseSpreadsheet, previewImport, setGuestGroup, updateGuest } from "@/app/actions/dashboard";
import { CSV_TEMPLATE, FIELDS, parseTable, suggestMapping, type Field, type Mapping, type RowResult } from "@/lib/import";
import { Empty, Modal, useToast } from "./ui";

export interface GuestRow {
  id: string; name: string; phone: string; email: string; group: string; category: string; maxPax: number; notes: string; token: string; optedOut: boolean;
  rsvp: string | null; sent: boolean; opened: boolean; table: string;
}

export function GuestsClient({ eventId, slug, base, rows, groups }: { eventId: string; slug: string; base: string; rows: GuestRow[]; groups: string[] }) {
  const router = useRouter();
  const [toast, show] = useToast();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fRsvp, setFRsvp] = useState("");
  const [fSent, setFSent] = useState("");
  const [sort, setSort] = useState<"name" | "pax">("name");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(100);
  const [modal, setModal] = useState<null | "add" | "import" | { qr: GuestRow }>(null);
  const [bulkGroup, setBulkGroup] = useState("");

  const link = (g: GuestRow) => `${base}/i/${slug}?to=${encodeURIComponent(g.name)}&g=${g.token}`;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((g) => (!n || g.name.toLowerCase().includes(n) || g.phone.includes(n)) && (!fGroup || g.group === fGroup) && (!fRsvp || (fRsvp === "none" ? !g.rsvp : g.rsvp === fRsvp)) && (!fSent || (fSent === "sent" ? g.sent : fSent === "unsent" ? !g.sent : !g.opened)))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : b.maxPax - a.maxPax));
  }, [rows, q, fGroup, fRsvp, fSent, sort]);
  const visible = filtered.slice(0, limit);
  const refresh = () => start(() => router.refresh());
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = visible.length > 0 && visible.every((g) => sel.has(g.id));

  const edit = async (g: GuestRow, patch: Parameters<typeof updateGuest>[2]) => {
    const r = await updateGuest(eventId, g.id, patch);
    show(r.ok ? "Tersimpan" : r.error);
    if (r.ok) refresh();
  };
  const copy = async (text: string, msg: string) => { try { await navigator.clipboard.writeText(text); show(msg); } catch { show("Gagal menyalin"); } };

  return (
    <div className="space-y-4">
      {toast}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl">Tamu <span className="muted text-base">({rows.length})</span></h1>
        <div className="flex gap-2 flex-wrap"><button className="btn" onClick={() => setModal("import")}>Impor CSV/XLSX</button><a className="btn" href={`/api/export/guests.xlsx?eventId=${eventId}`}>Ekspor</a><button className="btn btn-primary" onClick={() => setModal("add")}>+ Tambah tamu</button></div>
      </div>
      <div className="card grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Cari nama / telepon" aria-label="Cari" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" aria-label="Filter grup" value={fGroup} onChange={(e) => setFGroup(e.target.value)}><option value="">Semua grup</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <select className="input" aria-label="Filter RSVP" value={fRsvp} onChange={(e) => setFRsvp(e.target.value)}><option value="">Semua RSVP</option><option value="attending">Hadir</option><option value="declined">Tidak hadir</option><option value="maybe">Mungkin</option><option value="none">Belum RSVP</option></select>
        <select className="input" aria-label="Filter pengiriman" value={fSent} onChange={(e) => setFSent(e.target.value)}><option value="">Semua pengiriman</option><option value="sent">Terkirim</option><option value="unsent">Belum terkirim</option><option value="unopened">Belum dibuka</option></select>
        <select className="input" aria-label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value as "name")}><option value="name">Urut nama</option><option value="pax">Urut pax</option></select>
      </div>
      {sel.size > 0 && (
        <div className="card flex flex-wrap items-center gap-2" role="region" aria-label="Aksi massal">
          <b className="text-sm">{sel.size} dipilih</b>
          <input className="input" style={{ width: 160 }} placeholder="Nama grup" list="groups" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} />
          <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          <button className="btn btn-sm" disabled={!bulkGroup} onClick={async () => { const r = await setGuestGroup(eventId, [...sel], bulkGroup); show(r.ok ? "Grup diperbarui" : r.error); setSel(new Set()); refresh(); }}>Tambah ke grup</button>
          <button className="btn btn-sm" onClick={() => copy(rows.filter((g) => sel.has(g.id)).map((g) => `${g.name}\t${link(g)}`).join("\n"), "Link tersalin")}>Salin link</button>
          <a className="btn btn-sm" href="/dashboard/blast">Kirim blast</a>
          <button className="btn btn-sm btn-danger" onClick={async () => { if (!confirm(`Hapus ${sel.size} tamu beserta RSVP-nya?`)) return; const r = await deleteGuests(eventId, [...sel]); show(r.ok ? "Terhapus" : r.error); setSel(new Set()); refresh(); }}>Hapus</button>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty icon="👥" title="Belum ada tamu" hint="Tambahkan manual atau impor dari CSV/Excel. Setiap tamu mendapat link unik dan QR."><button className="btn btn-primary" onClick={() => setModal("import")}>Impor tamu</button></Empty>
      ) : (
        <div className="card p-0 overflow-auto max-h-[70vh]">
          <table className="tbl">
            <thead><tr><th><input type="checkbox" aria-label="Pilih semua" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(visible.map((g) => g.id)))} /></th><th>Nama</th><th>Telepon</th><th>Grup</th><th>Pax</th><th>RSVP</th><th>Status</th><th>Meja</th><th>Aksi</th></tr></thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.id}>
                  <td><input type="checkbox" aria-label={`Pilih ${g.name}`} checked={sel.has(g.id)} onChange={() => toggle(g.id)} /></td>
                  <td><input className="input" style={{ minWidth: 150, border: "1px solid transparent", background: "transparent" }} defaultValue={g.name} aria-label={`Nama ${g.name}`} onBlur={(e) => e.target.value !== g.name && edit(g, { name: e.target.value })} />{g.category === "VIP" && <span className="badge ml-1">VIP</span>}{g.optedOut && <span className="badge badge-bad ml-1">STOP</span>}</td>
                  <td><input className="input" style={{ minWidth: 130, border: "1px solid transparent", background: "transparent" }} defaultValue={g.phone} aria-label={`Telepon ${g.name}`} onBlur={(e) => e.target.value !== g.phone && edit(g, { phone: e.target.value })} /></td>
                  <td className="whitespace-nowrap">{g.group || "–"}</td>
                  <td><input type="number" min={1} max={20} className="input" style={{ width: 64, border: "1px solid transparent", background: "transparent" }} defaultValue={g.maxPax} aria-label={`Pax ${g.name}`} onBlur={(e) => Number(e.target.value) !== g.maxPax && edit(g, { maxPax: Number(e.target.value) })} /></td>
                  <td>{g.rsvp ? <span className={`badge ${g.rsvp === "attending" ? "badge-ok" : g.rsvp === "declined" ? "badge-bad" : ""}`}>{g.rsvp === "attending" ? "Hadir" : g.rsvp === "declined" ? "Tidak" : "Mungkin"}</span> : <span className="muted">Belum</span>}</td>
                  <td className="whitespace-nowrap text-xs">{g.sent ? "✉️ Terkirim" : "–"} {g.opened ? "👁 Dibuka" : ""}</td>
                  <td>{g.table || "–"}</td>
                  <td className="whitespace-nowrap"><button className="btn btn-sm" onClick={() => copy(link(g), "Link tersalin")}>Link</button> <button className="btn btn-sm" onClick={() => setModal({ qr: g })}>QR</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-6 text-center muted text-sm">Tidak ada tamu yang cocok dengan filter.</p>}
          {filtered.length > limit && <div className="p-3 text-center"><button className="btn btn-sm" onClick={() => setLimit((l) => l + 200)}>Tampilkan lebih ({filtered.length - limit})</button></div>}
        </div>
      )}
      {modal === "add" && <AddGuest eventId={eventId} groups={groups} onClose={() => setModal(null)} onDone={(m) => { show(m); refresh(); }} />}
      {modal === "import" && <ImportWizard eventId={eventId} onClose={() => setModal(null)} onDone={() => refresh()} />}
      {modal && typeof modal === "object" && <QrModal g={modal.qr} url={link(modal.qr)} onClose={() => setModal(null)} />}
    </div>
  );
}

function AddGuest({ eventId, groups, onClose, onDone }: { eventId: string; groups: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", group: "", category: "REGULAR" as "REGULAR" | "VIP" | "FAMILY", maxPax: 2, notes: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Tambah tamu" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await addGuest(eventId, f); setBusy(false); if (r.ok) { onDone("Tamu ditambahkan"); onClose(); } else setErr(r.error); }}>
        <label className="label" htmlFor="ag-n">Nama</label><input id="ag-n" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="ag-p">WhatsApp</label><input id="ag-p" className="input" placeholder="0812…" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label" htmlFor="ag-e">Email</label><input id="ag-e" className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><label className="label" htmlFor="ag-g">Grup</label><input id="ag-g" className="input" list="ag-groups" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} /><datalist id="ag-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
          <div><label className="label" htmlFor="ag-c">Kategori</label><select id="ag-c" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as "VIP" })}><option>REGULAR</option><option>VIP</option><option>FAMILY</option></select></div>
          <div><label className="label" htmlFor="ag-x">Maks. pax</label><input id="ag-x" className="input" type="number" min={1} max={20} value={f.maxPax} onChange={(e) => setF({ ...f, maxPax: Number(e.target.value) })} /></div>
        </div>
        <label className="label" htmlFor="ag-o">Catatan</label><input id="ag-o" className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <p role="alert" className="text-sm mt-2" style={{ color: "var(--app-danger)" }}>{err}</p>
        <button className="btn btn-primary mt-3 w-full" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
      </form>
    </Modal>
  );
}

function QrModal({ g, url, onClose }: { g: GuestRow; url: string; onClose: () => void }) {
  const [src, setSrc] = useState("");
  useMemo(() => { void QRCode.toDataURL(url, { margin: 1, width: 280 }).then(setSrc); }, [url]);
  return (
    <Modal title={`QR · ${g.name}`} onClose={onClose}>
      <div className="text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={`QR link ${g.name}`} width={280} height={280} className="mx-auto bg-white p-2 rounded-lg" /> : <div className="skeleton mx-auto" style={{ width: 280, height: 280 }} />}
        <p className="text-xs muted break-all">{url}</p>
        {src && <a className="btn" href={src} download={`qr-${g.name}.png`}>Unduh PNG</a>}
      </div>
    </Modal>
  );
}

type Report = { created: number; updated: number; skipped: number; failed: number; failedCsv: string };

function ImportWizard({ eventId, onClose, onDone }: { eventId: string; onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [table, setTable] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [results, setResults] = useState<RowResult[]>([]);
  const [strategy, setStrategy] = useState<"skip" | "update" | "create">("skip");
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setErr("");
    setBusy(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await parseSpreadsheet(eventId, fd);
        if (!r.ok) { setErr(r.error); return; }
        setTable(r.data);
        setMapping(suggestMapping(r.data.headers));
      } else {
        const t = parseTable(await file.text());
        setTable({ headers: t.headers, rows: t.rows });
        setMapping(suggestMapping(t.headers));
      }
      setStep(1);
    } finally { setBusy(false); }
  };
  const preview = async () => {
    if (!table) return;
    setBusy(true);
    const r = await previewImport(eventId, table.rows, mapping);
    setBusy(false);
    if (r.ok) { setResults(r.data.results); setStep(2); } else setErr(r.error);
  };
  const commit = async () => {
    if (!table) return;
    setBusy(true);
    const r = await commitImport(eventId, table.rows, mapping, strategy);
    setBusy(false);
    if (r.ok) { setReport(r.data); setStep(3); onDone(); } else setErr(r.error);
  };
  const dl = (name: string, content: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/csv" })); a.download = name; a.click(); };
  const bad = results.filter((r) => r.errors.length).length;
  const dups = results.filter((r) => r.duplicate).length;

  return (
    <Modal title={`Impor tamu · langkah ${step + 1}/4`} onClose={onClose}>
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm muted">Unggah file .csv atau .xlsx (maks. 5.000 baris). Header & pemisah dideteksi otomatis.</p>
          <input type="file" accept=".csv,.xlsx,.txt" className="input" aria-label="Pilih file" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="btn btn-sm" onClick={() => dl("template-tamu.csv", CSV_TEMPLATE)}>Unduh template CSV</button>
        </div>
      )}
      {step === 1 && table && (
        <div>
          <p className="text-sm muted mb-2">{table.rows.length} baris terdeteksi. Cocokkan kolom:</p>
          {FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-2 gap-2 items-center mb-1">
              <label className="text-sm" htmlFor={`m-${f.key}`}>{f.label}{f.required ? " *" : ""}</label>
              <select id={`m-${f.key}`} className="input" value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value === "") delete n[f.key as Field]; else n[f.key as Field] = Number(e.target.value); return n; })}>
                <option value="">(abaikan)</option>{table.headers.map((h, i) => <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-primary w-full mt-3" disabled={mapping.name === undefined || busy} onClick={preview}>{busy ? "Memeriksa…" : "Pratinjau & validasi"}</button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm"><span className="badge badge-ok">{results.length - bad} valid</span> <span className="badge badge-bad">{bad} error</span> <span className="badge">{dups} duplikat</span></p>
          <div className="overflow-auto max-h-56 border rounded-lg" style={{ borderColor: "var(--app-border)" }}>
            <table className="tbl"><thead><tr><th>#</th><th>Nama</th><th>Telepon</th><th>Status</th></tr></thead><tbody>
              {results.slice(0, 100).map((r) => (<tr key={r.index}><td>{r.index}</td><td>{r.data.name}</td><td>{r.data.phone ?? "–"}</td><td className="text-xs">{r.errors.length ? <span style={{ color: "var(--app-danger)" }}>{r.errors.join("; ")}</span> : r.duplicate ? `Duplikat (${r.duplicate.reason}, ${Math.round(r.duplicate.score * 100)}%) ≈ ${r.duplicate.of}` : "OK"}</td></tr>))}
            </tbody></table>
          </div>
          <label className="label" htmlFor="strat">Jika duplikat</label>
          <select id="strat" className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as "skip")}><option value="skip">Lewati</option><option value="update">Perbarui data yang ada</option><option value="create">Buat sebagai tamu baru</option></select>
          <button className="btn btn-primary w-full" disabled={busy || results.length === bad} onClick={commit}>{busy ? "Mengimpor…" : `Impor ${results.length - bad} baris valid`}</button>
        </div>
      )}
      {step === 3 && report && (
        <div className="space-y-3" role="status">
          <p>✅ Dibuat <b>{report.created}</b> · diperbarui <b>{report.updated}</b> · dilewati <b>{report.skipped}</b> · gagal <b>{report.failed}</b></p>
          {report.failed > 0 && <button className="btn" onClick={() => dl("baris-gagal.csv", report.failedCsv)}>Unduh CSV baris gagal</button>}
          <button className="btn btn-primary w-full" onClick={onClose}>Selesai</button>
        </div>
      )}
      <p role="alert" className="text-sm mt-2" style={{ color: "var(--app-danger)" }}>{err}</p>
    </Modal>
  );
}
