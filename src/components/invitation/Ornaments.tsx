import type { CSSProperties } from "react";
import type { TemplateKey } from "@/templates";

/** Hand-made SVG art. No external assets. Colours come from CSS variables of the active template. */

export function ArtPhoto({ seed = 1, label }: { seed?: number; label?: string }) {
  const hue = (seed * 47) % 360;
  const id = `ap${seed}`;
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label ?? "Ilustrasi foto"}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 35% 78%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 30% 55%)`} />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${id}g)`} />
      <circle cx={120 + (seed % 5) * 40} cy="150" r="46" fill="#fff" opacity=".55" />
      <path d="M0 360 Q100 280 200 340 T400 320 V500 H0Z" fill={`hsl(${hue} 25% 38%)`} opacity=".55" />
      <path d="M0 420 Q120 350 230 410 T400 390 V500 H0Z" fill={`hsl(${hue} 25% 28%)`} opacity=".7" />
      <g fill="#fff" opacity=".85">
        <circle cx="170" cy="300" r="16" />
        <path d="M140 400 q30 -90 60 0z" />
        <circle cx="230" cy="306" r="15" />
        <path d="M202 400 q28 -85 56 0z" />
      </g>
    </svg>
  );
}

export function Divider({ kind }: { kind: TemplateKey }) {
  const common = { className: "inv-divider", viewBox: "0 0 140 24", fill: "none", stroke: "currentColor", strokeWidth: 1, "aria-hidden": true } as const;
  switch (kind) {
    case "elegant-ivory":
      return (<svg {...common}><path d="M4 12h52M84 12h52" /><path d="M70 4l8 8-8 8-8-8z" /><circle cx="60" cy="12" r="1.5" fill="currentColor" /><circle cx="80" cy="12" r="1.5" fill="currentColor" /></svg>);
    case "modern-minimal":
      return (<svg {...common}><path d="M0 12h140" strokeWidth=".5" /><rect x="64" y="8" width="8" height="8" fill="currentColor" stroke="none" /></svg>);
    case "floral-botanical":
      return (<svg {...common}><path d="M4 12c20-10 40 10 62 0M74 12c22 10 42-10 62 0" /><circle cx="70" cy="12" r="4" /><path d="M70 4c3 3 3 5 0 8M70 20c3-3 3-5 0-8M62 12c3-3 5-3 8 0M78 12c-3 3-5 3-8 0" /></svg>);
    case "adat-jawa":
      return (<svg {...common}><path d="M4 12h44M92 12h44" /><ellipse cx="70" cy="7" rx="4" ry="6" /><ellipse cx="70" cy="17" rx="4" ry="6" /><ellipse cx="63" cy="12" rx="6" ry="4" /><ellipse cx="77" cy="12" rx="6" ry="4" /></svg>);
    case "islamic-green":
      return (<svg {...common}><path d="M4 12h48M88 12h48" /><path d="M70 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" /></svg>);
    case "rustic":
      return (<svg {...common} strokeLinecap="round"><path d="M6 14q14-10 28 0t28 0 28 0 28 0" /><path d="M66 6c0 6 4 8 8 8" /></svg>);
    case "bold-editorial":
      return (<svg {...common}><path d="M0 12h140" strokeWidth="4" /></svg>);
    case "luxe-gold-dark":
      return (<svg {...common}><path d="M4 12h50l6-6 10 6-10 6-6-6M136 12H86l-6-6-10 6 10 6 6-6" /></svg>);
  }
}

const petals = Array.from({ length: 9 }, (_, i) => ({ left: `${(i * 11 + 5) % 100}%`, delay: `${(i * 1.3) % 7}s`, dur: `${9 + (i % 4) * 2}s` }));
const dust = Array.from({ length: 16 }, (_, i) => ({ left: `${(i * 6.5 + 3) % 100}%`, delay: `${(i * 0.9) % 8}s`, dur: `${7 + (i % 5)}s` }));

export function CoverArt({ kind, initials, names, halves }: { kind: TemplateKey; initials: string; names: string; halves?: boolean }) {
  switch (kind) {
    case "elegant-ivory":
      return (
        <>
          <div className="flap" />
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="var(--accent)" aria-hidden>
            <rect x="22" y="22" width="356" height="756" strokeWidth="1" />
            <rect x="32" y="32" width="336" height="736" strokeWidth=".5" />
            {[[32, 32, 1, 1], [368, 32, -1, 1], [32, 768, 1, -1], [368, 768, -1, -1]].map(([x, y, sx, sy], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
                <path d="M0 40 Q0 0 40 0M0 28 Q0 12 12 12 Q20 12 20 20 Q20 28 12 28" strokeWidth="1" />
              </g>
            ))}
            <circle cx="200" cy="690" r="30" strokeWidth="1" />
            <text x="200" y="700" textAnchor="middle" fontSize="26" fill="var(--accent-text)" stroke="none" style={{ fontFamily: "var(--font-display)" }}>{initials}</text>
          </svg>
        </>
      );
    case "modern-minimal":
      return (
        <>
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden stroke="var(--text)" fill="none">
            <path d="M40 0V800M360 0V800M0 120H400M0 680H400" strokeWidth=".4" />
            <rect x="320" y="60" width="28" height="28" fill="var(--accent)" stroke="none" />
            {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={60 + i * 24} cy="720" r="2" fill="var(--text)" stroke="none" />)}
          </svg>
          <div className="ticker" aria-hidden><div>{`${names} • SAVE THE DATE • `.repeat(8)}</div></div>
        </>
      );
    case "floral-botanical":
      return (
        <>
          <svg className="draw" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path className="d" pathLength={1} d="M-10 120 C60 140 40 220 110 250 S160 340 90 400 S20 520 80 560" />
            <path className="d" pathLength={1} d="M410 680 C340 660 360 580 290 550 S240 460 310 400 S380 280 320 240" style={{ animationDelay: ".6s" }} />
            <path className="d" pathLength={1} d="M-10 780 C80 740 140 770 200 730" style={{ animationDelay: "1.2s" }} />
            {[[110, 250], [90, 400], [310, 400], [290, 550], [60, 140]].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`} stroke="none">
                {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} rx="6" ry="14" cy="-12" fill="var(--accent2)" transform={`rotate(${r})`} />)}
                <circle r="5" fill="var(--accent-text)" />
              </g>
            ))}
            {[[40, 200], [150, 330], [60, 520], [340, 330], [260, 480]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y}) rotate(${i * 50})`} d="M0 0c14-14 28-6 30 4-14 8-26 8-30-4z" fill="var(--accent)" stroke="none" opacity=".7" />)}
          </svg>
          {petals.map((p, i) => <span key={i} className="petal" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur } as CSSProperties} />)}
        </>
      );
    case "adat-jawa":
      return (
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <pattern id={`kw${halves ? "h" : ""}`} width="40" height="40" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="#C8A24A" strokeOpacity=".35"><ellipse cx="20" cy="10" rx="6" ry="10" /><ellipse cx="20" cy="30" rx="6" ry="10" /><ellipse cx="10" cy="20" rx="10" ry="6" /><ellipse cx="30" cy="20" rx="10" ry="6" /></g>
            </pattern>
          </defs>
          <rect width="400" height="800" fill="#2A1A12" />
          <rect width="400" height="800" fill={`url(#kw${halves ? "h" : ""})`} />
          <g fill="none" stroke="#C8A24A" strokeWidth="2">
            <path d="M200 150 C150 230 110 300 110 400 C110 520 150 580 200 640 C250 580 290 520 290 400 C290 300 250 230 200 150Z" fill="#5B3A29" />
            <path d="M200 200 C170 260 150 320 150 400 C150 480 170 530 200 580 C230 530 250 480 250 400 C250 320 230 260 200 200Z" />
            <path d="M200 260V560M180 340 Q200 320 220 340M175 420 Q200 400 225 420M180 500 Q200 480 220 500" />
            <circle cx="200" cy="140" r="8" fill="#C8A24A" />
          </g>
          <path d="M0 40H400M0 760H400" stroke="#C8A24A" strokeWidth="1" />
        </svg>
      );
    case "islamic-green":
      return (
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <rect width="400" height="800" fill="var(--bg)" />
          <path d="M60 760V300 C60 160 140 90 200 60 C260 90 340 160 340 300V760Z" fill="var(--text)" opacity=".92" />
          <path d="M84 760V310 C84 190 150 124 200 98 C250 124 316 190 316 310V760Z" fill="none" stroke="var(--accent)" strokeWidth="2" />
          <g className="spin" fill="none" stroke="var(--accent)" strokeWidth="1.5">
            <g transform="translate(200 300)"><rect x="-60" y="-60" width="120" height="120" /><rect x="-60" y="-60" width="120" height="120" transform="rotate(45)" /><circle r="30" /></g>
          </g>
          <path d="M200 110c-14 6-22 18-22 32 0 18 14 30 34 30-26 2-42-14-42-32 0-20 16-36 36-36 -2 2-4 4-6 6z" fill="var(--accent)" transform="translate(0 -40) scale(1)" />
          <g className="sway"><path d="M110 60V110" stroke="var(--accent)" /><path d="M96 110h28l-4 40h-20z" fill="var(--accent)" opacity=".9" /></g>
          <g className="sway" style={{ animationDelay: "1s" }}><path d="M290 60V110" stroke="var(--accent)" /><path d="M276 110h28l-4 40h-20z" fill="var(--accent)" opacity=".9" /></g>
        </svg>
      );
    case "rustic":
      return (
        <>
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
            <path d="M0 40 Q200 120 400 40" stroke="#8a6a44" strokeWidth="3" strokeDasharray="2 4" />
            <path d="M30 700 q40-30 80 0 t80 0 80 0 80 0" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <path className="d" pathLength={1} d="M320 620 q30-40 10-80 M330 580 q20-10 30 0" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <rect x="150" y="30" width="100" height="26" fill="var(--accent2)" opacity=".7" transform="rotate(-4 200 43)" />
          </svg>
          {[{ l: "6%", t: "10%", r0: "-30deg", r1: "-7deg", d: "0s", s: 1 }, { l: "52%", t: "14%", r0: "40deg", r1: "6deg", d: ".3s", s: 2 }, { l: "28%", t: "56%", r0: "-50deg", r1: "-3deg", d: ".6s", s: 3 }].map((p) => (
            <div key={p.s} className="pol" style={{ left: p.l, top: p.t, animationDelay: p.d, ["--r0" as string]: p.r0, ["--r1" as string]: p.r1 } as CSSProperties}><ArtPhoto seed={p.s + 3} /></div>
          ))}
        </>
      );
    case "bold-editorial":
      return (
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <rect x="0" y="0" width="400" height="14" fill="var(--text)" />
          <text x="24" y="60" fontSize="12" fill="var(--text)" style={{ fontFamily: "var(--font-body)", letterSpacing: ".3em" }}>WEDDING ISSUE No. 01</text>
          <rect x="24" y="700" width="84" height="40" fill="var(--accent)" />
          <text x="66" y="726" textAnchor="middle" fontSize="11" fill="#fff" style={{ fontFamily: "var(--font-body)", fontWeight: 700 }}>EXCLUSIVE</text>
          {Array.from({ length: 28 }, (_, i) => <rect key={i} x={260 + i * 4} y="690" width={i % 3 === 0 ? 3 : 1.5} height="50" fill="var(--text)" />)}
          <rect x="0" y="770" width="400" height="30" fill="var(--text)" />
          <text x="24" y="790" fontSize="10" fill="var(--bg)" style={{ fontFamily: "var(--font-body)", letterSpacing: ".2em" }}>{names.toUpperCase()} · P.01</text>
        </svg>
      );
    case "luxe-gold-dark":
      return (
        <>
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <defs>
              <linearGradient id={`vl${halves ? "h" : ""}`} x1="0" x2="1">
                {Array.from({ length: 9 }, (_, i) => <stop key={i} offset={i / 8} stopColor={i % 2 ? "#17171f" : "#0b0b0d"} />)}
              </linearGradient>
            </defs>
            <rect width="400" height="800" fill={`url(#vl${halves ? "h" : ""})`} />
            <g stroke="#D4AF37" strokeOpacity=".7" fill="none">
              <path d="M200 0V800" strokeWidth="2" />
              <path d="M20 20H120L140 40M380 20H280L260 40M20 780H120L140 760M380 780H280L260 760" strokeWidth="1" />
              {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M200 400L${200 + 220 * Math.cos((i * Math.PI) / 6)} ${400 + 220 * Math.sin((i * Math.PI) / 6)}`} strokeWidth=".4" />)}
            </g>
          </svg>
        </>
      );
  }
}

export function Dust() {
  return <>{dust.map((p, i) => <span key={i} className="dustp" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur } as CSSProperties} />)}</>;
}
