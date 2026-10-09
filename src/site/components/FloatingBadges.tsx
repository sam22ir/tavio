/** Decorative 3D tiles around the hero visual. Hidden below md. */
const TONES = ['#1f5f55', '#c2410c', '#25d366', '#0f1a17', '#7fa99c'];
const POS = ['start-[-3%] top-[14%]', 'start-[4%] bottom-[10%]', 'end-[-2%] top-[10%]', 'end-[6%] bottom-[18%]', 'start-[40%] -top-[4%]'];

export function FloatingBadges({ labels }: { labels: string[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      {labels.map((label, i) => (
        <div key={label} className={`s-badge s-float absolute ${POS[i % POS.length]}`} style={{ animationDelay: `${i * -1.3}s` }}>
          <i style={{ background: `linear-gradient(150deg, ${TONES[i % TONES.length]}, #0f1a17)` }} />
          {label}
        </div>
      ))}
    </div>
  );
}
