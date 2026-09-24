// Generated per activity type rather than fetched. A stock photo service is
// one more thing that can fail live, and a stray landscape photo on a pottery
// class reads worse than deliberate abstract art. Swap for real venue photos
// when there are any.

const ART = {
  cafe_hangout: { hue: 28, shapes: [[22, 62, 15], [50, 40, 22], [78, 66, 12]] },
  class_workshop: { hue: 262, shapes: [[26, 44, 18], [55, 66, 14], [80, 38, 20]] },
  park_event: { hue: 132, shapes: [[20, 70, 20], [48, 46, 26], [76, 72, 16]] },
  food_tasting: { hue: 12, shapes: [[24, 50, 19], [52, 70, 15], [80, 44, 21]] },
  arts_craft: { hue: 292, shapes: [[28, 66, 17], [56, 38, 23], [82, 60, 13]] },
  community_meetup: { hue: 202, shapes: [[18, 48, 21], [46, 68, 17], [74, 42, 24]] },
  fitness_casual: { hue: 172, shapes: [[24, 64, 16], [54, 42, 25], [80, 68, 14]] },
  family_playtime: { hue: 48, shapes: [[22, 46, 22], [50, 70, 16], [78, 40, 19]] },
};

export default function SessionArt({ activity, seed = 0 }) {
  const { hue, shapes } = ART[activity] ?? ART.community_meetup;

  return (
    <svg className="art" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`g${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 42% 88%)`} />
          <stop offset="100%" stopColor={`hsl(${hue + 24} 38% 74%)`} />
        </linearGradient>
      </defs>
      <rect width="100" height="42" fill={`url(#g${seed})`} />
      {shapes.map(([cx, cy, r], i) => (
        <circle
          key={i}
          cx={cx + (seed % 5)}
          cy={cy * 0.42}
          r={r * 0.42}
          fill={`hsl(${hue + i * 18} 46% ${62 - i * 7}%)`}
          opacity={0.5 - i * 0.08}
        />
      ))}
    </svg>
  );
}
