/**
 * Stylized kabaddi court (top-down).
 * Coordinate system used everywhere: x in [0,100], y in [0,100].
 * Mid-line at y=50 (left side = team A, right side = team B).
 */
export type CourtPoint = { x: number; y: number; success: boolean; type?: string };

type Props = {
  points?: CourtPoint[];
  onTap?: (p: { x: number; y: number }) => void;
  className?: string;
};

export function KabaddiCourt({ points = [], onTap, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`w-full rounded-2xl ${className}`}
      style={{ background: "var(--court)", aspectRatio: "13 / 10" }}
      onClick={(e) => {
        if (!onTap) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        onTap({ x, y });
      }}
    >
      {/* Outer boundary */}
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="var(--court-line)" strokeWidth="0.6" />
      {/* Mid line */}
      <line x1="50" y1="2" x2="50" y2="98" stroke="var(--court-line)" strokeWidth="0.5" />
      {/* Baulk lines */}
      <line x1="30" y1="2" x2="30" y2="98" stroke="var(--court-line)" strokeWidth="0.3" strokeDasharray="1 1" />
      <line x1="70" y1="2" x2="70" y2="98" stroke="var(--court-line)" strokeWidth="0.3" strokeDasharray="1 1" />
      {/* Bonus lines */}
      <line x1="20" y1="2" x2="20" y2="98" stroke="var(--court-line)" strokeWidth="0.2" strokeDasharray="0.5 0.8" opacity="0.6" />
      <line x1="80" y1="2" x2="80" y2="98" stroke="var(--court-line)" strokeWidth="0.2" strokeDasharray="0.5 0.8" opacity="0.6" />
      {/* Lobbies */}
      <line x1="2" y1="20" x2="98" y2="20" stroke="var(--court-line)" strokeWidth="0.3" />
      <line x1="2" y1="80" x2="98" y2="80" stroke="var(--court-line)" strokeWidth="0.3" />
      {/* Side labels */}
      <text x="15" y="52" fontSize="3.5" fill="var(--court-line)" opacity="0.6" fontWeight="700">TEAM A</text>
      <text x="62" y="52" fontSize="3.5" fill="var(--court-line)" opacity="0.6" fontWeight="700">TEAM B</text>

      {/* Heatmap dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="2.2"
          fill={p.success ? "oklch(0.72 0.20 145)" : "oklch(0.62 0.24 25)"}
          opacity="0.75"
          stroke="white"
          strokeWidth="0.3"
        />
      ))}
    </svg>
  );
}
