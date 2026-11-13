import type { CSSProperties, ReactNode } from "react";
import "./invitation.css";
import { fontVariables } from "./fonts";
import { ArtPhoto, CoverArt, Divider } from "./Ornaments";
import { ClaimButton, Countdown, CopyButton, Gallery, Reveal, RsvpForm, Shell, StreamFacade, TableSearch, WishBoard } from "./client";
import { getTemplate, type TemplateKey } from "@/templates";
import { FONT_CHOICES, type SectionType } from "@/lib/invitation-config";
import { dictFor } from "@/lib/i18n";
import { formatDate, formatTime, TZ_IANA } from "@/lib/tz";
import { googleCalendarUrl } from "@/lib/ics";
import { waLink } from "@/lib/phone";
import type { InvData } from "@/server/invitation";

export interface InvitationProps {
  data: InvData;
  toName: string;
  archived?: boolean;
  readOnly?: boolean;
}

const initials = (a: string, b: string) => `${a.charAt(0)}${b.charAt(0)}`.toUpperCase();

export function Invitation({ data, toName, archived = false, readOnly = false }: InvitationProps) {
  const { event, subEvents, guest } = data;
  const tpl = getTemplate(event.templateSlug);
  const cfg = event.config;
  const L = dictFor(event.language);
  const locale = event.language === "en" ? "en-GB" : "id-ID";
  const tz = event.timezone;
  const c = { ...tpl.colors, ...cfg.theme };
  const displayFont = cfg.theme.displayFont ? FONT_CHOICES[cfg.theme.displayFont].css : tpl.fonts.display;
  const first = subEvents[0];
  const firstDate = first ? new Date(first.startsAt) : null;
  const style = {
    "--bg": c.bg, "--surface": c.surface, "--text": c.text, "--muted": c.muted, "--accent": c.accent, "--accent-text": c.accentText, "--accent2": tpl.colors.accent2,
    "--on-accent": tpl.colors.onAccent, "--radius": cfg.theme.radius ?? tpl.radius, "--font-display": displayFont, "--font-body": tpl.fonts.body, "--font-accent": tpl.fonts.accent, "--font-script": tpl.fonts.script,
  } as CSSProperties;
  const tk = tpl.slug as TemplateKey;
  const halves = tk === "adat-jawa" || tk === "luxe-gold-dark";
  const names = `${event.groomName} & ${event.brideName}`;
  const dateLabel = firstDate ? formatDate(firstDate, tz, locale, { dateStyle: "long" }) : "";
  const pics = data.pics.map((p) => ({ name: `${p.name}${p.role ? ` · ${p.role}` : ""}`, href: waLink(p.phone, L.waText.replace("{name}", toName).replace("{event}", event.title)) }));
  const photoShape = tpl.layout.photo;
  const visible = cfg.sections.filter((x) => x.visible);
  const gate = (t: SectionType): boolean => {
    if (archived && ["rsvp", "wish", "seating", "date", "events", "live", "gift"].includes(t) && t !== "wish") return false;
    if (t === "events") return subEvents.length > 0;
    if (t === "live") return subEvents.some((x) => x.streamingUrl);
    if (t === "story") return cfg.texts.loveStory.length > 0;
    if (t === "customary") return cfg.texts.customary.length > 0;
    if (t === "gift") return data.gifts.length > 0 || data.wishlist.length > 0;
    if (t === "date") return !!firstDate;
    if (t === "dress") return cfg.texts.dressColors.length > 0 || !!cfg.texts.dressNote;
    if (t === "seating") return true;
    return true;
  };
  const sections = visible.filter((v) => gate(v.type));

  const mapsHref = (x: { mapsUrl: string; venue: string; address: string }) => x.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${x.venue} ${x.address}`)}`;
  const wazeHref = (x: { venue: string; address: string }) => `https://waze.com/ul?q=${encodeURIComponent(`${x.venue} ${x.address}`)}&navigate=yes`;

  const render = (type: SectionType, i: number): ReactNode => {
    const id = i === 0 ? "sec-first" : `sec-${type}`;
    const alt = i % 2 === 1 ? "alt" : "";
    const wrap = (inner: ReactNode) => (<section key={`${type}-${i}`} id={id} className={`inv-sec ${alt}`}>{inner}</section>);
    switch (type) {
      case "couple":
        return wrap(
          <Reveal>
            {tk === "islamic-green" && (<><p className="arabic" lang="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p><p className="inv-p">Bismillahirrahmanirrahim</p></>)}
            {tk === "adat-jawa" && <p className="inv-script">Rahayu</p>}
            <p className="inv-eyebrow">{L.couple}</p>
            {cfg.texts.greeting && <p className="inv-p">{cfg.texts.greeting}</p>}
            {cfg.texts.quote && (<p className="inv-p" style={{ fontStyle: "italic" }}>“{cfg.texts.quote}”<br /><b style={{ fontStyle: "normal" }}>{cfg.texts.quoteSource}</b></p>)}
            <Divider kind={tk} />
            <div className="inv-photo" data-shape={photoShape}><ArtPhoto seed={3} label={event.groomName} /></div>
            <h2 className="inv-h2">{event.groomFull || event.groomName}</h2>
            <p className="inv-p">{L.sonOf} {event.groomParents}</p>
            <p className="inv-script" style={{ fontSize: "2.4rem" }}>&amp;</p>
            <div className="inv-photo" data-shape={photoShape}><ArtPhoto seed={9} label={event.brideName} /></div>
            <h2 className="inv-h2">{event.brideFull || event.brideName}</h2>
            <p className="inv-p">{L.daughterOf} {event.brideParents}</p>
          </Reveal>,
        );
      case "date":
        if (!firstDate) return null;
        return wrap(
          <Reveal>
            <p className="inv-eyebrow">{L.date}</p>
            {tpl.layout.heading === "huge" ? (<div className="bigdate">{new Intl.DateTimeFormat(locale, { timeZone: TZ_IANA[tz], day: "2-digit" }).format(firstDate)}</div>) : null}
            <h2 className="inv-h2">{formatDate(firstDate, tz, locale, tpl.layout.heading === "huge" ? { month: "long", year: "numeric" } : { dateStyle: "full" })}</h2>
            <Countdown target={first?.startsAt ?? ""} labels={L} />
            <div className="inv-row">
              <a className="inv-btn" href={`/api/public/${event.slug}/calendar`} download>{L.addCal} (.ics)</a>
              {first && <a className="inv-btn inv-btn--ghost" target="_blank" rel="noopener noreferrer" href={googleCalendarUrl({ uid: first.id, title: event.title, start: new Date(first.startsAt), end: first.endsAt ? new Date(first.endsAt) : null, location: `${first.venue}, ${first.address}` })}>{L.googleCal}</a>}
            </div>
          </Reveal>,
        );
      case "events":
        return wrap(
          <>
            <Reveal><p className="inv-eyebrow">{L.events}</p><h2 className="inv-h2">{event.groomName} &amp; {event.brideName}</h2></Reveal>
            <div style={{ display: "grid", gap: 16 }}>
              {subEvents.map((x, k) => (
                <Reveal key={x.id} delay={k * 120}>
                  <div className="inv-card">
                    <h3 className="inv-h2" style={{ fontSize: "1.5rem" }}>{x.name}</h3>
                    <p className="inv-p"><b>{formatDate(new Date(x.startsAt), tz, locale)}</b><br />{formatTime(new Date(x.startsAt), tz)}{x.endsAt ? ` – ${formatTime(new Date(x.endsAt), tz)}` : ""}</p>
                    <p className="inv-p"><b>{x.venue}</b><br />{x.address}</p>
                    {x.dressCode && <p className="inv-p">{L.dress}: {x.dressCode}</p>}
                    <div className="inv-row">
                      <a className="inv-btn" href={mapsHref(x)} target="_blank" rel="noopener noreferrer">{L.maps}</a>
                      <a className="inv-btn inv-btn--ghost" href={wazeHref(x)} target="_blank" rel="noopener noreferrer">{L.waze}</a>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </>,
        );
      case "story":
        return wrap(<Reveal><p className="inv-eyebrow">{L.story}</p><h2 className="inv-h2">{L.story}</h2><div className="tl">{cfg.texts.loveStory.map((x, k) => (<div key={k}><small>{x.date}</small><h3>{x.title}</h3><p className="inv-p">{x.text}</p></div>))}</div></Reveal>);
      case "gallery":
        return wrap(<Reveal><p className="inv-eyebrow">{L.gallery}</p><h2 className="inv-h2">{L.gallery}</h2><Gallery count={6} labels={L} /></Reveal>);
      case "live":
        return wrap(<Reveal><p className="inv-eyebrow">{L.live}</p><h2 className="inv-h2">{L.live}</h2>{subEvents.filter((x) => x.streamingUrl).map((x) => (<div key={x.id} style={{ marginBottom: 14 }}><p className="inv-p">{x.name}</p><StreamFacade url={x.streamingUrl} label={L.watch} /></div>))}</Reveal>);
      case "dress":
        return wrap(<Reveal><p className="inv-eyebrow">{L.dress}</p><h2 className="inv-h2">{L.dress}</h2><p className="inv-p">{cfg.texts.dressNote}</p><div className="inv-row">{cfg.texts.dressColors.map((col) => (<span key={col} role="img" aria-label={col} style={{ width: 44, height: 44, borderRadius: "50%", background: col, border: "1px solid var(--muted)" }} />))}</div></Reveal>);
      case "customary":
        return wrap(<Reveal><p className="inv-eyebrow">{L.customary}</p><h2 className="inv-h2">{L.customary}</h2><div style={{ display: "grid", gap: 10 }}>{cfg.texts.customary.map((x, k) => <p key={k} className="inv-card inv-p" style={{ margin: 0 }}>{x}</p>)}</div></Reveal>);
      case "gift":
        return wrap(
          <Reveal>
            <p className="inv-eyebrow">{L.gift}</p><h2 className="inv-h2">{L.gift}</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {data.gifts.map((g) => (
                <div className="inv-card" key={g.id}>
                  <b>{g.provider}</b><p className="inv-p" style={{ margin: "6px 0" }}>{g.accountName}</p>
                  <p style={{ font: "600 1.3rem var(--font-display)", letterSpacing: ".06em", margin: "4px 0 10px" }}>{g.accountNumber}</p>
                  <CopyButton text={g.accountNumber} labels={L} />
                </div>
              ))}
            </div>
            {data.wishlist.length > 0 && (
              <>
                <h3 className="inv-h2" style={{ fontSize: "1.4rem", marginTop: 28 }}>{L.wishlist}</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  {data.wishlist.map((w) => (
                    <div className="inv-card" key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span>{w.name}</span>
                      <ClaimButton slug={event.slug} itemId={w.id} claimedBy={w.claimedBy} labels={L} readOnly={readOnly} defaultName={toName} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Reveal>,
        );
      case "rsvp":
        return wrap(
          <Reveal>
            <p className="inv-eyebrow">{L.rsvp}</p><h2 className="inv-h2">{L.rsvp}</h2>
            <RsvpForm slug={event.slug} token={guest?.token ?? null} guestName={guest?.name ?? ""} maxPax={guest?.maxPax ?? 5} subEvents={subEvents.map((x) => ({ id: x.id, name: x.name }))} menus={data.menus} existing={guest?.rsvps ?? []} qr={guest?.qr ?? {}} labels={L} readOnly={readOnly} />
          </Reveal>,
        );
      case "wish":
        return wrap(<Reveal><p className="inv-eyebrow">{L.wish}</p><h2 className="inv-h2">{L.wish}</h2><WishBoard slug={event.slug} token={guest?.token ?? null} guestName={guest?.name ?? ""} initial={data.wishes} labels={L} readOnly={readOnly || archived} /></Reveal>);
      case "seating":
        return wrap(<Reveal><p className="inv-eyebrow">{L.seating}</p><h2 className="inv-h2">{L.seating}</h2>{guest?.table && <p className="inv-p" style={{ color: "var(--text)" }}>{guest.name} {L.seatAt} <b style={{ fontSize: "1.6em", color: "var(--accent-text)" }}>{guest.table}</b></p>}<TableSearch slug={event.slug} labels={L} readOnly={readOnly} /></Reveal>);
    }
  };

  return (
    <div className={`inv ${fontVariables}`} data-tpl={tpl.slug} data-align={tpl.layout.align} data-heading={tpl.layout.heading} style={style}>
      <noscript><style>{".rv{opacity:1!important;transform:none!important;filter:none!important}"}</style></noscript>
      <Shell
        tpl={tpl.slug} halves={halves} withDust={tk === "luxe-gold-dark"} cover={<CoverArt kind={tk} initials={initials(event.groomName, event.brideName)} names={names} halves={halves} />}
        names={[event.groomName, event.brideName]} dateLabel={dateLabel} toName={toName} kicker={L.wedding} dear={L.dear} openLabel={L.open} hint={L.tapHint} coverCta={event.language === "en" && tpl.coverCta !== L.open ? L.open : tpl.coverCta}
        pics={pics} music={cfg.texts.music === "ambient"} labels={L}
      >
        <div className="inv-wrap">
          <aside className="inv-side" aria-hidden>
            <Divider kind={tk} />
            <h2>{event.groomName} &amp; {event.brideName}</h2>
            <p>{dateLabel}</p>
          </aside>
          <main className="inv-col" data-shape-root>
            {sections.map((x, i) => render(x.type, i))}
            <footer className="inv-sec" style={{ paddingBottom: 100 }}>
              <Divider kind={tk} />
              <p className="inv-p">{archived ? L.archived : cfg.texts.thanks}</p>
              <p className="inv-script">{event.groomName} &amp; {event.brideName}</p>
              <p className="inv-p" style={{ fontSize: ".75rem", marginTop: 24 }}>Made with WeddingOS</p>
            </footer>
          </main>
          <aside className="inv-side" aria-hidden><Divider kind={tk} /><p>{event.title}</p></aside>
        </div>
      </Shell>
    </div>
  );
}
