"use client";

import { useState } from "react";
import { TEMPLATES } from "@/templates";

export function PhonePreview({ initial, switcher = false, lang = "id" }: { initial: string; switcher?: boolean; lang?: "id" | "en" }) {
  const [slug, setSlug] = useState(initial);
  return (
    <div className="flex flex-col items-center gap-3">
      {switcher && (
        <div className="flex gap-1 flex-wrap justify-center max-w-md" role="tablist" aria-label="Pilih template">
          {TEMPLATES.map((t) => <button key={t.slug} role="tab" aria-selected={slug === t.slug} onClick={() => setSlug(t.slug)} className={`btn btn-sm ${slug === t.slug ? "btn-primary" : ""}`}>{t.name}</button>)}
        </div>
      )}
      <div className="rounded-[2.4rem] p-3 shadow-2xl" style={{ background: "#111", width: 330, maxWidth: "100%" }}>
        <div className="rounded-[1.8rem] overflow-hidden bg-white" style={{ height: 640 }}>
          <iframe key={slug} title={`Pratinjau ${slug}`} src={`/demo/${slug}?to=Tamu%20Undangan${lang === "en" ? "&lang=en" : ""}`} loading="lazy" className="w-full h-full border-0" />
        </div>
      </div>
      <p className="text-xs muted">Pratinjau interaktif: ketuk “Buka” di dalam ponsel.</p>
    </div>
  );
}
