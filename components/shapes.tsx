// Hand-cut shapes from the Backyard posts: the paint splat, starbursts and
// scribbled arrows. Paths are generated from a seed so they look hand-made
// but render identically on every build.

type SvgProps = { className?: string; style?: React.CSSProperties };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Builds a closed splat outline: a lumpy body with hand-cut spikes. */
function buildSplat(seed: number, w: number, h: number, spikes: number): string {
  const rand = mulberry32(seed);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * 0.34;
  const ry = h * 0.36;
  // Spikes reach further sideways than up/down so they stay clear of text.
  const pt = (angle: number, r: number) =>
    `${r1(cx + Math.cos(angle) * rx * r)} ${r1(cy + Math.sin(angle) * ry * (1 + (r - 1) * 0.45))}`;

  const step = (Math.PI * 2) / spikes;
  type Spike = { left: string; tip: string; right: string; valley: string };
  const list: Spike[] = [];
  for (let i = 0; i < spikes; i++) {
    const a = i * step + (rand() - 0.5) * step * 0.5;
    const half = step * (0.1 + rand() * 0.12);
    const long = rand() > 0.55;
    const tipR = long ? 1.28 + rand() * 0.18 : 1.08 + rand() * 0.12;
    const skew = (rand() - 0.5) * half;
    const base = 0.95 + rand() * 0.06;
    list.push({
      left: pt(a - half, base),
      tip: pt(a + skew, tipR),
      right: pt(a + half, base),
      valley: pt(a + step / 2, 0.9 + rand() * 0.12),
    });
  }
  return (
    list
      .map((s, i) => {
        const next = list[(i + 1) % list.length];
        return `${i === 0 ? `M ${s.left} ` : ""}L ${s.tip} L ${s.right} Q ${s.valley} ${next.left}`;
      })
      .join(" ") + " Z"
  );
}

const SPLAT_W = 1000;
const SPLAT_H = 640;
const HERO_SPLAT = buildSplat(7, SPLAT_W, SPLAT_H, 15);

/** Stretches to fill its box, so size it with the className. */
export function Splat({
  id,
  className,
  style,
  color = "var(--color-forest)",
  hatch = "var(--color-hatch)",
}: SvgProps & { id: string; color?: string; hatch?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SPLAT_W} ${SPLAT_H}`}
      className={className}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={`${id}-hatch`}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(32)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="16"
            stroke={hatch}
            strokeWidth="3"
            strokeDasharray="9 3 14 4"
            opacity="0.55"
          />
        </pattern>
      </defs>
      <path d={HERO_SPLAT} fill={color} />
      <path d={HERO_SPLAT} fill={`url(#${id}-hatch)`} />
    </svg>
  );
}

function starburstPath(seed: number, points: number): string {
  const rand = mulberry32(seed);
  const parts: string[] = [];
  const step = (Math.PI * 2) / points;
  for (let i = 0; i < points; i++) {
    const a = i * step + (rand() - 0.5) * step * 0.35;
    const outer = 46 + rand() * 4;
    const inner = 15 + rand() * 9;
    const b = a + step / 2 + (rand() - 0.5) * step * 0.25;
    parts.push(
      `${i === 0 ? "M" : "L"} ${r1(50 + Math.cos(a) * outer)} ${r1(50 + Math.sin(a) * outer)}`,
      `L ${r1(50 + Math.cos(b) * inner)} ${r1(50 + Math.sin(b) * inner)}`,
    );
  }
  return parts.join(" ") + " Z";
}

const BURSTS = [starburstPath(3, 9), starburstPath(21, 11), starburstPath(42, 8)];

export function Starburst({
  className,
  style,
  color = "var(--color-rust)",
  variant = 0,
  scribble = true,
}: SvgProps & { color?: string; variant?: 0 | 1 | 2; scribble?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path d={BURSTS[variant]} fill={color} />
      {scribble && (
        <path
          d="M38 44 L52 40 M36 52 L58 47 M40 59 L56 55 M47 35 L55 33"
          stroke="var(--color-paper)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.55"
        />
      )}
    </svg>
  );
}

/** Looping scribbled arrow, like the ones around “why BBQs”. */
export function ScribbleArrow({ className, style, color = "var(--color-orange)" }: SvgProps & { color?: string }) {
  const d =
    "M104 26 C 92 8, 52 4, 30 18 C 10 31, 8 62, 30 76 C 50 89, 80 84, 96 70";
  const head = "M96 70 L 78 66 M96 70 L 92 52";
  return (
    <svg viewBox="0 0 120 96" className={className} style={style} aria-hidden="true" fill="none">
      <path d={d} stroke="white" strokeWidth="14" strokeLinecap="round" />
      <path d={head} stroke="white" strokeWidth="14" strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d={head} stroke={color} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

/** Line drawing of a plate with cutlery, from the “our model” page. */
export function Plate({ className, style, color = "var(--color-ink)" }: SvgProps & { color?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={className} style={style} aria-hidden="true" fill="none">
      <g stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="100" cy="70" r="52" fill="var(--color-card)" />
        <circle cx="100" cy="70" r="36" />
        <path d="M84 62 c 6 -8, 14 -8, 18 0 c 4 8, 12 8, 16 0" />
        <path d="M84 80 c 10 8, 22 8, 32 0" />
        <path d="M86 72 l 4 4 m 6 -6 l 4 4 m 6 -4 l 4 4" />
        {/* spoon */}
        <ellipse cx="26" cy="38" rx="10" ry="14" transform="rotate(-25 26 38)" />
        <path d="M32 50 L 42 112" />
        {/* fork */}
        <path d="M168 24 L 168 44 M176 22 L 176 44 M184 24 L 184 44" />
        <path d="M166 44 Q 176 54, 186 44" />
        <path d="M176 50 L 170 114" />
      </g>
    </svg>
  );
}
