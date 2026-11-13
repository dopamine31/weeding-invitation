import {
  Playfair_Display, Inter, Cormorant_Garamond, DM_Serif_Display, DM_Sans, Jost, Pinyon_Script,
  Cormorant_SC, Amiri, Lora, Caveat, Amatic_SC, Anton, Cinzel,
} from "next/font/google";

// Self-hosted at build time by next/font (no runtime Google Fonts requests).
// next/font needs literal option objects, so every call is written out in full.
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-playfair", style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-inter" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-cormorant", weight: ["300", "400", "500", "600"], style: ["normal", "italic"] });
const dmserif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmserif", weight: "400" });
const dmsans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-dmsans" });
const jost = Jost({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-jost" });
const pinyon = Pinyon_Script({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-pinyon", weight: "400" });
const cormorantsc = Cormorant_SC({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-cormorantsc", weight: ["400", "500", "600", "700"] });
const amiri = Amiri({ subsets: ["latin", "arabic"], display: "swap", preload: false, variable: "--f-amiri", weight: ["400", "700"] });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-lora" });
const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-caveat" });
const amatic = Amatic_SC({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-amatic", weight: ["400", "700"] });
const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-anton", weight: "400" });
const cinzel = Cinzel({ subsets: ["latin"], display: "swap", preload: false, variable: "--f-cinzel" });

export const fontVariables = [playfair, inter, cormorant, dmserif, dmsans, jost, pinyon, cormorantsc, amiri, lora, caveat, amatic, anton, cinzel]
  .map((f) => f.variable)
  .join(" ");
