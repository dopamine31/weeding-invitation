"use client";

import { useEffect, useState } from "react";
import { selfieCheckin } from "@/app/i/[slug]/selfie";
import { shrinkImage } from "@/lib/shrink";

const T = {
  id: { title: "Check-in dengan Selfie", hint: "Saat tiba di lokasi, ambil selfie untuk mencatat kehadiran Anda.", take: "Ambil selfie", retake: "Ulangi foto", consent: "Foto saya boleh disimpan dan ditampilkan kepada pengantin.", send: "Check-in sekarang", busy: "Mengirim…", ok: "Terima kasih, kehadiran Anda tercatat!", already: "Kehadiran Anda sudah tercatat sebelumnya." },
  en: { title: "Selfie Check-in", hint: "When you arrive, take a selfie to record your attendance.", take: "Take selfie", retake: "Retake", consent: "My photo may be stored and shown to the couple.", send: "Check in now", busy: "Sending…", ok: "Thank you, your attendance is recorded!", already: "Your attendance was already recorded." },
};

export function SelfieCheckin({ slug, token, lang }: { slug: string; token: string; lang: string }) {
  const t = lang === "en" ? T.en : T.id;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const small = await shrinkImage(f, 1024);
    setFile(small);
    setUrl(URL.createObjectURL(small));
    setMsg(null);
  };
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("consent", consent ? "yes" : "no");
    const r = await selfieCheckin(slug, token, fd);
    setBusy(false);
    if (r.ok) { setMsg({ text: r.data.already ? t.already : t.ok, good: true }); setFile(null); setUrl(null); }
    else setMsg({ text: r.error, good: false });
  };

  const done = msg?.good === true;
  return (
    <div style={{ marginTop: 28, textAlign: "center" }}>
      <h3 className="inv-h2" style={{ fontSize: "1.2em" }}>{t.title}</h3>
      <p className="inv-p">{t.hint}</p>
      {!done && (
        <>
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Selfie" style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 16, margin: "12px auto", display: "block" }} />
          )}
          <label className="inv-btn" style={{ cursor: "pointer", display: "inline-block" }}>
            {file ? t.retake : t.take}
            <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {file && (
            <div style={{ marginTop: 12 }}>
              <label className="inv-p" style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "flex-start", textAlign: "left", maxWidth: 360, margin: "0 auto" }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 4 }} /> {t.consent}
              </label>
              <button className="inv-btn" style={{ marginTop: 10 }} disabled={!consent || busy} onClick={() => void submit()}>{busy ? t.busy : t.send}</button>
            </div>
          )}
        </>
      )}
      {msg && <p role="status" className="inv-p" style={{ marginTop: 10, color: msg.good ? "var(--accent-text)" : "#b91c1c" }}>{msg.text}</p>}
    </div>
  );
}
