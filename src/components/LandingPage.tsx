import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface LandingPageProps {
  onLogin: () => void;
}

/* ─── Reveal on scroll ─────────────────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); }
      },
      { threshold: 0.16, rootMargin: '0px 0px -36px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className={`landing-reveal${isVisible ? ' landing-reveal--visible' : ''}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Leaf-flutter letters ──────────────────────────────────────────────────── */
function LeafText({ text, color, startDelay = 0 }: { text: string; color?: string; startDelay?: number }) {
  return (
    <span aria-label={text} style={{ color }}>
      {Array.from(text).map((ch, i) => (
        <span
          aria-hidden="true"
          className="leaf-letter"
          key={`${ch}-${i}`}
          style={{
            '--leaf-delay': `${startDelay + i * 34}ms`,
            '--leaf-drift': `${i % 2 === 0 ? -18 : 18}px`,
            '--leaf-settle': `${i % 2 === 0 ? 3 : -3}px`,
            '--leaf-rotation': `${i % 2 === 0 ? -14 : 14}deg`,
          } as CSSProperties}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );
}

/* ─── Typewriter for scroll sections ───────────────────────────────────────── */
function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  let ci = 0;
  return (
    <span aria-label={text}>
      {text.split(/(\s+)/).map((part, pi) => {
        if (/^\s+$/.test(part)) return <span key={`space-${pi}`}>{part}</span>;
        return (
          <span aria-hidden="true" key={`${part}-${pi}`} style={{ display: 'inline-block' }}>
            {Array.from(part).map((ch) => {
              const idx = ci++;
              return (
                <span
                  className="principles-typewriter-letter"
                  key={`${ch}-${idx}`}
                  style={{ '--typewriter-delay': `${delay + idx * 22}ms` } as CSSProperties}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

/* ─── Hero cycling typewriter ───────────────────────────────────────────────── */
const HERO_WORDS = ['evidence.', 'clarity.', 'precision.', 'truth.', 'answers.'];

function CyclingTypewriter() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing' | 'hold' | 'erasing'>('typing');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timerRef.current = setTimeout(fn, ms);
  }, []);

  useEffect(() => {
    const word = HERO_WORDS[wordIndex];
    if (phase === 'typing') {
      if (displayed.length < word.length) schedule(() => setDisplayed(word.slice(0, displayed.length + 1)), 60);
      else schedule(() => setPhase('hold'), 1800);
    } else if (phase === 'hold') {
      schedule(() => setPhase('erasing'), 0);
    } else if (phase === 'erasing') {
      if (displayed.length > 0) schedule(() => setDisplayed(displayed.slice(0, -1)), 38);
      else { setWordIndex((i) => (i + 1) % HERO_WORDS.length); setPhase('typing'); }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [displayed, phase, wordIndex, schedule]);

  return (
    <span style={{ color: '#EF4444', display: 'inline-block', minWidth: '1ch' }}>
      {displayed}
      <span style={{
        display: 'inline-block', width: '3px', height: '0.85em',
        background: '#EF4444', marginLeft: '2px', verticalAlign: 'middle',
        animation: 'cursorBlink 0.9s step-end infinite',
      }} />
    </span>
  );
}

/* ─── Animated score counter ────────────────────────────────────────────────── */
function AnimatedScore({ target, delay = 0 }: { target: number; delay?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let start = 0;
      const step = () => {
        start += Math.ceil((target - start) / 8) || 1;
        setVal(Math.min(start, target));
        if (start < target) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay]);

  const color = val <= 29 ? '#6B7280' : val <= 49 ? '#3BB2F6' : val <= 69 ? '#F59E0B' : val <= 84 ? '#F97316' : '#EF4444';

  return (
    <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 'inherit', transition: 'color 0.3s' }}>
      {val}
    </span>
  );
}

/* ─── Floating particle field ───────────────────────────────────────────────── */
function ParticleField() {
  const particles = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    dur: 8 + Math.random() * 20,
    delay: Math.random() * 12,
    driftX: (Math.random() - 0.5) * 60,
    driftY: -(20 + Math.random() * 60),
    opacity: 0.15 + Math.random() * 0.4,
  }));

  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}
    >
      {particles.map((p) => (
        <circle
          key={p.id}
          cx={`${p.x}%`}
          cy={`${p.y}%`}
          r={p.size}
          fill="#EF4444"
          opacity={p.opacity}
        >
          <animate
            attributeName="cx"
            values={`${p.x}%;${p.x + p.driftX * 0.5}%;${p.x + p.driftX}%;${p.x}%`}
            dur={`${p.dur}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values={`${p.y}%;${p.y + p.driftY * 0.5}%;${p.y + p.driftY}%;${p.y}%`}
            dur={`${p.dur}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={`${p.opacity};${p.opacity * 0.3};${p.opacity};${p.opacity * 0.6};${p.opacity}`}
            dur={`${p.dur * 0.7}s`}
            begin={`${p.delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/* ─── Floating wireframe shapes ─────────────────────────────────────────────── */
function WireframeShapes() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}
    >
      {/* Top-right octagon */}
      <polygon
        points="900,30 940,10 980,10 1010,30 1010,70 980,90 940,90 900,70"
        fill="none" stroke="rgba(239,68,68,0.07)" strokeWidth="1"
        className="shape-orbit"
        style={{ transformOrigin: '955px 50px', animationDuration: '32s' }}
      />
      {/* Mid-left triangle */}
      <polygon
        points="60,200 110,300 10,300"
        fill="none" stroke="rgba(59,178,246,0.06)" strokeWidth="1"
        className="shape-orbit"
        style={{ transformOrigin: '60px 250px', animationDuration: '44s', animationDirection: 'reverse' }}
      />
      {/* Bottom-right diamond */}
      <polygon
        points="1080,380 1120,420 1080,460 1040,420"
        fill="none" stroke="rgba(245,158,11,0.07)" strokeWidth="1"
        className="shape-orbit"
        style={{ transformOrigin: '1080px 420px', animationDuration: '28s' }}
      />
      {/* Center-left hexagon */}
      <polygon
        points="100,450 130,432 160,450 160,486 130,504 100,486"
        fill="none" stroke="rgba(239,68,68,0.05)" strokeWidth="1"
        className="shape-orbit"
        style={{ transformOrigin: '130px 468px', animationDuration: '38s', animationDirection: 'reverse' }}
      />
      {/* Small cross */}
      <path d="M820 120 L860 120 M840 100 L840 140" stroke="rgba(59,178,246,0.08)" strokeWidth="1"
        className="shape-pulse" />
      <path d="M200 340 L240 340 M220 320 L220 360" stroke="rgba(245,158,11,0.07)" strokeWidth="1"
        className="shape-pulse" style={{ animationDelay: '1.4s' }} />
    </svg>
  );
}

/* ─── Radar ping badge ───────────────────────────────────────────────────────── */
function RadarPing() {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: '10px', height: '10px' }}>
      <span className="radar-ring" style={{ animationDelay: '0s' }} />
      <span className="radar-ring" style={{ animationDelay: '0.7s' }} />
      <span style={{
        position: 'absolute', inset: '50%', transform: 'translate(-50%,-50%)',
        width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444',
      }} />
    </span>
  );
}

/* ─── Data grid ─────────────────────────────────────────────────────────────── */
const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="9" cy="9" r="6" stroke="#3BB2F6" strokeWidth="1.5" />
        <path d="M13.5 13.5L19 19" stroke="#3BB2F6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="9" r="2" fill="#3BB2F6" opacity="0.4" />
      </svg>
    ),
    title: 'Evidence-Linked Confidence',
    body: 'Every confidence score is clickable. No black-box verdicts — each number traces directly to the evidence set that produced it.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="4" cy="11" r="2.5" stroke="#F97316" strokeWidth="1.5" />
        <circle cx="11" cy="4" r="2.5" stroke="#F97316" strokeWidth="1.5" />
        <circle cx="18" cy="11" r="2.5" stroke="#F97316" strokeWidth="1.5" />
        <circle cx="11" cy="18" r="2.5" stroke="#F97316" strokeWidth="1.5" />
        <circle cx="11" cy="11" r="2" fill="#F97316" opacity="0.4" />
        <path d="M6.5 11H8.5M13.5 11H15.5M11 6.5V8.5M11 13.5V15.5" stroke="#F97316" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Network Graph Analysis',
    body: 'Map relationships between entities, clusters, and evidence items across complex networks with interactive force-directed visualisation.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="16" height="16" rx="2" stroke="#10B981" strokeWidth="1.5" />
        <path d="M3 8h16M8 3v5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M6 13h3M6 16h6" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Temporal Analysis',
    body: 'Timeline views surface sequencing patterns invisible in static reports. Understand not just what happened — but when, and in what order.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3L14.5 8.5H19L15.5 12L17 18L11 14.5L5 18L6.5 12L3 8.5H7.5L11 3Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Probabilistic Language',
    body: 'The interface enforces hypothesis language throughout. "Evidence suggests" — never "confirmed." Uncertainty is a first-class citizen.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="4" y="4" width="14" height="14" rx="2" stroke="#EF4444" strokeWidth="1.5" />
        <path d="M8 11h6M11 8v6" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    title: 'Clear-Web Resolution',
    body: 'Surface-web indicators are automatically cross-referenced with entity clusters. Domain registrations, social profiles, and registry records in one view.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M5 5h12v10H5V5z" stroke="#94A3B8" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 19h6M11 15v4" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 9h6M8 12h4" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Audit-Ready Reports',
    body: 'Generate structured intelligence reports from any investigation. Every claim is traceable to its source evidence item and analyst.',
  },
];

const bands = [
  { range: '0–29', label: 'Very Weak', color: '#6B7280', desc: 'Dismissed edges, weak correlations' },
  { range: '30–49', label: 'Low', color: '#3BB2F6', desc: 'Informational, weak correlations' },
  { range: '50–69', label: 'Moderate', color: '#F59E0B', desc: 'Candidate connections, review needed' },
  { range: '70–84', label: 'High', color: '#F97316', desc: 'Strong evidence, investigate further' },
  { range: '85–100', label: 'Very High', color: '#EF4444', desc: 'Critical evidence, urgent review' },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function LandingPage({ onLogin }: LandingPageProps) {
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);
  const [confidenceVisible, setConfidenceVisible] = useState(false);
  const confidenceRef = useRef<HTMLElement>(null);
  const [principlesVisible, setPrinciplesVisible] = useState(false);
  const principlesRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  /* mouse parallax state */
  const [mouse, setMouse] = useState({ x: 50, y: 50 });
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMouse({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  useEffect(() => {
    const section = confidenceRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setConfidenceVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.12, rootMargin: '0px 0px -48px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = principlesRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setPrinciplesVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.12, rootMargin: '0px 0px -48px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const px = mouse.x;
  const py = mouse.y;

  return (
    <div style={{ background: '#0F172A', color: '#F1F5F9', fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', position: 'relative', isolation: 'isolate' }}>
      {/* Animated gradient background */}
      <div className="landing-background-animated" aria-hidden="true" />

      {/* Mouse-parallax blob glows */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          transition: 'background 0.08s linear',
          background: `radial-gradient(ellipse 50% 40% at ${px}% ${py}%, rgba(239,68,68,0.50) 0%, rgba(239,68,68,0.10) 30%, transparent 70%)`,
        }}
      />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className={`landing-nav${scrolled ? ' landing-nav--scrolled' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div className="logo-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4" stroke="white" strokeWidth="1.6" />
              <path d="M9.5 9.5L13 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="6.5" cy="6.5" r="1.3" fill="white" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em' }}>
            Shadow<span style={{ color: '#EF4444' }}>Trace</span>
            <span style={{ fontSize: '10px', fontWeight: 400, color: '#475569', marginLeft: '5px' }}>AI</span>
          </span>
        </div>

        <div className="landing-nav-links">
          {['Platform', 'Evidence', 'Confidence', 'Security'].map((item) => (
            <button key={item} className="nav-link-btn">{item}</button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="landing-nav-actions">
          <button
            className="landing-pop-button landing-nav-forward"
            onClick={onLogin}
            style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px', cursor: 'pointer', padding: '0' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
          >
            Forward
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button className="landing-pop-button" onClick={onLogin} style={{
            background: 'transparent', border: '1px solid #334155', borderRadius: '6px',
            padding: '7px 16px', fontSize: '13px', color: '#94A3B8', cursor: 'pointer',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#475569'; (e.currentTarget as HTMLButtonElement).style.color = '#F1F5F9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
          >
            Sign in
          </button>
          <button className="landing-pop-button cta-pulse-btn" onClick={onLogin} style={{
            background: '#EF4444', border: 'none', borderRadius: '6px', padding: '7px 18px',
            fontSize: '13px', fontWeight: 600, color: 'white', cursor: 'pointer',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#DC2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#EF4444')}
          >
            Request access
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="hero-section" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Animated grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.035, pointerEvents: 'none' }}>
          <defs>
            <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" className="grid-drift" />
        </svg>

        {/* Particles */}
        <ParticleField />

        {/* Wireframe shapes */}
        <WireframeShapes />

        {/* Parallax glows */}
        <div style={{
          position: 'absolute', top: '-120px', left: '50%',
          transform: `translateX(calc(-50% + ${(px - 50) * 0.18}px)) translateY(${(py - 50) * 0.12}px)`,
          width: '900px', height: '600px',
          background: 'radial-gradient(ellipse, rgba(239,68,68,0.1) 0%, transparent 65%)',
          pointerEvents: 'none', transition: 'transform 0.15s ease-out',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '8%',
          transform: `translateX(${(px - 50) * -0.1}px) translateY(${(py - 50) * 0.08}px)`,
          width: '500px', height: '500px',
          background: 'radial-gradient(ellipse, rgba(59,178,246,0.08) 0%, transparent 65%)',
          pointerEvents: 'none', transition: 'transform 0.15s ease-out',
        }} />

        <div className="hero-inner" style={{ position: 'relative', maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          {/* Badge with radar ping */}
          <Reveal delay={80}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '20px', padding: '5px 14px', marginBottom: '32px',
              fontSize: '12px', fontWeight: 500, color: '#EF4444',
            }}>
              <RadarPing />
              Intelligence platform · v1.0 · September 2026
            </div>
          </Reveal>

          {/* Headline with glitch on hover */}
          <Reveal delay={190}>
            <h1
              className="hero-headline"
              style={{
                fontSize: 'clamp(32px, 6vw, 68px)',
                fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05,
                margin: '0 0 24px', color: '#F1F5F9',
              }}
            >
              <span className="glitch-text" data-text="Every confidence score">
                <LeafText text="Every confidence score" startDelay={80} />
              </span>
              <br />
              <LeafText text="links to its" color="#475569" startDelay={300} />{' '}
              <CyclingTypewriter />
            </h1>
          </Reveal>

          <Reveal delay={300}>
            <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: '#94A3B8', margin: '0 auto 40px', maxWidth: '560px', lineHeight: 1.7 }}>
              ShadowTrace is a dark-first investigative intelligence platform for analysts who need to move fast without losing rigor.
            </p>
          </Reveal>

          <Reveal delay={410} style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="landing-pop-button hero-cta-primary" onClick={onLogin}>
              Enter platform
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: '8px' }}>
                <path d="M3 7h8M8 4l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="landing-pop-button hero-cta-secondary">
              View documentation
            </button>
          </Reveal>

          {/* Live score demo */}
          <Reveal delay={520}>
            <div className="score-demo-bar">
              <span>Current analysis confidence:</span>
              <span style={{ fontSize: '22px' }}><AnimatedScore target={87} delay={600} /></span>
              <span className="score-badge-red">Very High</span>
              <span style={{ width: '1px', height: '16px', background: '#334155', margin: '0 4px' }} />
              <span style={{ color: '#3BB2F6', fontSize: '12px', cursor: 'pointer' }}>View 42 evidence items →</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Confidence bands ─────────────────────────────────────────────────── */}
      <section
        ref={confidenceRef}
        className={`confidence-scan-section${confidenceVisible ? ' confidence-typewriter-active' : ''}`}
        style={{ padding: 'clamp(40px, 8vw, 80px) clamp(16px, 5vw, 48px)', borderTop: '1px solid #1E293B' }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="confidence-layout">
            <Reveal style={{ flex: '0 0 300px', minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#EF4444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                <TypewriterText text="— Confidence system" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1.2 }}>
                <TypewriterText text="Five bands." delay={220} /><br />
                <TypewriterText text="No false certainty." delay={440} />
              </h2>
              <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, margin: 0 }}>
                <TypewriterText
                  text={'Red means "look closer," not "problem solved." High confidence scores demand more scrutiny, not less.'}
                  delay={680}
                />
              </p>
            </Reveal>

            <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bands.map((b, i) => (
                <div
                  key={b.range}
                  onMouseEnter={() => setHoveredBand(i)}
                  onMouseLeave={() => setHoveredBand(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
                    background: hoveredBand === i ? '#1E293B' : 'transparent',
                    border: `1px solid ${hoveredBand === i ? '#334155' : 'transparent'}`,
                    borderRadius: '8px', cursor: 'default', transition: 'all 0.15s',
                    boxShadow: hoveredBand === i ? `0 0 18px ${b.color}22` : 'none',
                  }}
                >
                  <div style={{ width: '40px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#475569', flexShrink: 0 }}>
                    <TypewriterText text={b.range} delay={900 + i * 220} />
                  </div>
                  <div style={{ flex: 1, height: '4px', background: '#1E293B', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '2px', background: b.color,
                      width: hoveredBand === i ? '100%' : '70%', transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
                      boxShadow: hoveredBand === i ? `0 0 8px ${b.color}` : 'none',
                    }} />
                  </div>
                  <div style={{ width: '80px', fontSize: '13px', fontWeight: 600, color: b.color, flexShrink: 0 }}>
                    <TypewriterText text={b.label} delay={960 + i * 220} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', flex: 1, opacity: hoveredBand === i ? 1 : 0.6, transition: 'opacity 0.2s' }}>
                    <TypewriterText text={b.desc} delay={1040 + i * 220} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(40px, 8vw, 80px) clamp(16px, 5vw, 48px)', borderTop: '1px solid #1E293B' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <Reveal style={{ marginBottom: '48px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              — Capabilities
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
              <LeafText text="Built for sustained analysis." startDelay={120} />
            </h2>
          </Reveal>

          <div
            className="features-golden-hover"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: '#1E293B', border: '1px solid #1E293B', borderRadius: '10px', overflow: 'hidden' }}
          >
            {features.map((f, i) => (
              <div
                className={`feature-card-shimmer ${i === 0 || i === 5 ? 'golden-feature-card-selected' : 'golden-feature-card'}`}
                key={f.title}
                style={{ background: '#0F172A', padding: '28px 24px', cursor: 'default', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = '#131f35')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = '#0F172A')}
              >
                <div style={{ marginBottom: '14px' }}>{f.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#F1F5F9', marginBottom: '8px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(32px, 6vw, 60px) clamp(16px, 5vw, 48px)', borderTop: '1px solid #1E293B', background: '#1E293B', position: 'relative', overflow: 'hidden' }}>
        {/* Scanline */}
        <div className="stats-scanline" aria-hidden="true" />
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '32px', position: 'relative' }}>
          {[
            { value: '5', unit: 'confidence bands', sub: 'Gray → Blue → Amber → Orange → Red' },
            { value: '7', unit: 'investigation views', sub: 'Overview, Graph, Timeline, Evidence, Clusters, Clear-Web, Report' },
            { value: '3', unit: 'navigation tiers', sub: 'Navbar · Sidebar · Page content' },
            { value: '∞', unit: 'evidence items', sub: 'All server-rendered, never client-computed' },
          ].map((s) => (
            <div key={s.unit} className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9', letterSpacing: '-0.03em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#CBD5E1', marginTop: '4px' }}>{s.unit}</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', maxWidth: '200px' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Design principles ────────────────────────────────────────────────── */}
      <section
        ref={principlesRef}
        className={principlesVisible ? 'principles-typewriter-active' : undefined}
        style={{ padding: 'clamp(40px, 8vw, 80px) clamp(16px, 5vw, 48px)', borderTop: '1px solid #1E293B' }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <Reveal style={{ marginBottom: '48px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              <TypewriterText text="— Design philosophy" />
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
              <TypewriterText text="Five principles. Zero exceptions." delay={220} />
            </h2>
          </Reveal>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { num: '01', title: 'Trust over flash', body: 'Every confidence score must be clickable to its supporting evidence. No decorative elements that reduce data density.' },
              { num: '02', title: 'Hypothesis language', body: 'Always probabilistic: "evidence suggests," "potential correlation." Never absolute: "confirmed," "matched," "found."' },
              { num: '03', title: 'Progressive disclosure', body: 'Dashboard shows summaries → click to expand details. Details panel opens on demand, never auto-expand.' },
              { num: '04', title: 'Dark-first & data-dense', body: 'Optimised for long analysis sessions. High information density over whitespace. Visualisations occupy maximum canvas space.' },
              { num: '05', title: 'No client-side authority', body: 'Frontend displays backend data only — never computes confidence scores. Server is the source of truth for all operations.' },
            ].map((p, i, arr) => (
              <div
                className="principle-hover-row principle-row-responsive"
                key={p.num}
                style={{
                  display: 'flex', gap: '32px', padding: '24px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid #1E293B' : 'none',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#334155', flexShrink: 0, paddingTop: '2px', width: '28px' }}>
                  <TypewriterText text={p.num} delay={620 + i * 360} />
                </div>
                <div style={{ flex: '0 0 220px', minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#F1F5F9' }}>
                    <TypewriterText text={p.title} delay={680 + i * 360} />
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.7, minWidth: 0 }}>
                  <TypewriterText text={p.body} delay={760 + i * 360} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(48px, 10vw, 100px) clamp(16px, 5vw, 48px)', borderTop: '1px solid #1E293B', position: 'relative', overflow: 'hidden' }}>
        {/* Orbiting ring */}
        <div className="cta-orbit-ring" aria-hidden="true" />
        <div className="cta-orbit-ring cta-orbit-ring--2" aria-hidden="true" />

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(239,68,68,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Reveal style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Ready to trace?
          </h2>
          <p style={{ fontSize: '15px', color: '#94A3B8', margin: '0 0 36px', lineHeight: 1.7 }}>
            Authorised analyst access only. All sessions are audited and attributed.
          </p>
          <button className="landing-pop-button hero-cta-primary" onClick={onLogin}>
            Enter ShadowTrace →
          </button>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #1E293B', padding: '24px clamp(16px, 5vw, 48px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', background: 'linear-gradient(135deg, #EF4444, #F97316)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="4" cy="4" r="2.5" stroke="white" strokeWidth="1.2" />
              <path d="M6 6L8.5 8.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ShadowTrace AI · v1.0</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy', 'Security', 'Audit policy', 'Contact'].map((item) => (
            <span key={item} style={{ fontSize: '12px', color: '#334155', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#94A3B8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#334155')}
            >{item}</span>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>
          © 2026 · Authorised use only
        </span>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════════
          STYLES
      ══════════════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Animated background ── */
        @keyframes gradientShift {
          0%   { background-position: 0% 0%; }
          25%  { background-position: 100% 20%; }
          50%  { background-position: 80% 100%; }
          75%  { background-position: 20% 80%; }
          100% { background-position: 0% 0%; }
        }

        .landing-background-animated {
          position: fixed; z-index: -1; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 50% at 10% 12%, rgba(239,68,68,0.09) 0%, transparent 70%),
            radial-gradient(ellipse 50% 44% at 88% 44%, rgba(59,178,246,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 44% 36% at 52% 92%, rgba(245,158,11,0.06) 0%, transparent 70%);
          background-size: 200% 200%;
          animation: gradientShift 16s ease-in-out infinite;
        }

        /* ── Cursor blink ── */
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* ── Pulse ── */
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── Nav ── */
        .landing-nav {
          position: sticky; top: 0; z-index: 100;
          background: rgba(15,23,42,0.82); backdrop-filter: blur(16px);
          border-bottom: 1px solid #1E293B;
          display: flex; align-items: center; padding: 0 48px; height: 56px; gap: 32px;
          transition: border-color 0.3s, box-shadow 0.3s;
        }

        .landing-nav--scrolled {
          border-bottom-color: rgba(239,68,68,0.25);
          box-shadow: 0 1px 0 rgba(239,68,68,0.08), 0 8px 32px rgba(0,0,0,0.3);
        }

        .landing-nav-links { display: flex; gap: 4px; margin-left: 8px; }
        .landing-nav-actions { display: flex; gap: 8px; align-items: center; }

        .nav-link-btn {
          background: transparent; border: none;
          padding: 5px 12px; fontSize: 13px; color: #94A3B8;
          cursor: pointer; border-radius: 6px;
          transition: color 0.15s, background 0.15s;
          font-size: 13px; font-family: inherit;
          position: relative;
        }
        .nav-link-btn::after {
          content: ''; position: absolute; bottom: 2px; left: 50%; right: 50%;
          height: 1px; background: #EF4444; transition: left 0.2s, right 0.2s;
        }
        .nav-link-btn:hover { color: #F1F5F9; }
        .nav-link-btn:hover::after { left: 12px; right: 12px; }

        /* ── Logo icon ── */
        .logo-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #EF4444 0%, #F97316 100%);
          border-radius: 7px; display: flex; align-items: center; justify-content: center;
          animation: logoGlow 3s ease-in-out infinite;
        }

        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%       { box-shadow: 0 0 14px 3px rgba(239,68,68,0.35); }
        }

        /* ── CTA pulse button ── */
        .cta-pulse-btn { position: relative; overflow: hidden; }
        .cta-pulse-btn::before {
          content: '';
          position: absolute; inset: 0; border-radius: 6px;
          animation: ctaPulseRing 2.4s ease-out infinite;
          box-shadow: 0 0 0 0 rgba(239,68,68,0.6);
        }
        @keyframes ctaPulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          70%  { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }

        /* ── Hero ── */
        .hero-section {
          padding: clamp(56px, 10vw, 100px) clamp(16px, 5vw, 48px) clamp(40px, 8vw, 80px);
        }

        /* Drifting grid */
        @keyframes gridDrift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(6px, 4px); }
          100% { transform: translate(0, 0); }
        }
        .grid-drift { animation: gridDrift 18s ease-in-out infinite; }

        /* ── Hero CTA buttons ── */
        .hero-cta-primary {
          background: #EF4444; border: none; border-radius: 7px;
          padding: 13px 28px; font-size: 15px; font-weight: 600;
          color: white; cursor: pointer;
          display: inline-flex; align-items: center;
          position: relative; overflow: hidden;
        }
        .hero-cta-primary::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }
        .hero-cta-primary:hover::after { transform: translateX(100%); }
        .hero-cta-primary:hover { background: #DC2626; }

        .hero-cta-secondary {
          background: transparent; border: 1px solid #334155; border-radius: 7px;
          padding: 13px 28px; font-size: 15px; color: #94A3B8; cursor: pointer;
          font-family: inherit;
          transition: border-color 0.15s, color 0.15s;
        }
        .hero-cta-secondary:hover { border-color: #475569; color: #F1F5F9; }

        /* ── Score demo bar ── */
        .score-demo-bar {
          margin-top: 64px; display: inline-flex; align-items: center;
          gap: 10px; padding: 10px 20px;
          background: #1E293B; border: 1px solid #334155; border-radius: 10px;
          font-size: 13px; color: #475569;
          animation: scoreBarFloat 5s ease-in-out infinite;
        }
        @keyframes scoreBarFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-5px); }
        }
        .score-badge-red {
          font-size: 11px; padding: 2px 8px; border-radius: 3px;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); color: #EF4444;
        }

        /* ── Glitch effect ── */
        .glitch-text { position: relative; display: inline-block; }
        .glitch-text:hover::before,
        .glitch-text:hover::after {
          content: attr(data-text);
          position: absolute; top: 0; left: 0; width: 100%;
          overflow: hidden; pointer-events: none;
        }
        .glitch-text:hover::before {
          color: #3BB2F6; animation: glitchTop 0.4s steps(2) infinite;
          clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%);
          text-shadow: -2px 0 #3BB2F6;
        }
        .glitch-text:hover::after {
          color: #EF4444; animation: glitchBot 0.4s steps(3) infinite 0.1s;
          clip-path: polygon(0 65%, 100% 65%, 100% 100%, 0 100%);
          text-shadow: 2px 0 #EF4444;
        }
        @keyframes glitchTop {
          0%   { transform: translate(-2px, -1px) skewX(-1deg); }
          33%  { transform: translate(2px, 1px) skewX(2deg); }
          66%  { transform: translate(-1px, 2px) skewX(-0.5deg); }
          100% { transform: translate(0, 0) skewX(0); }
        }
        @keyframes glitchBot {
          0%   { transform: translate(2px, 1px) skewX(1deg); }
          33%  { transform: translate(-2px, -1px) skewX(-2deg); }
          66%  { transform: translate(1px, -2px) skewX(0.5deg); }
          100% { transform: translate(0, 0) skewX(0); }
        }

        /* ── Radar ping ── */
        .radar-ring {
          position: absolute; top: 50%; left: 50%;
          width: 10px; height: 10px;
          border-radius: 50%;
          border: 1px solid #EF4444;
          transform: translate(-50%, -50%);
          animation: radarExpand 1.8s ease-out infinite;
        }
        @keyframes radarExpand {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
        }

        /* ── Floating wireframe shapes ── */
        @keyframes shapeOrbit {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shapePulse {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.14; }
        }
        .shape-orbit { animation: shapeOrbit 32s linear infinite; }
        .shape-pulse { animation: shapePulse 4s ease-in-out infinite; }

        /* ── Leaf flutter ── */
        @keyframes leafFlutterIn {
          0%   { opacity: 0; transform: translate(var(--leaf-drift), -28px) rotate(var(--leaf-rotation)) scale(0.88); }
          58%  { opacity: 1; transform: translate(var(--leaf-settle), 4px) rotate(-3deg) scale(1.02); }
          100% { opacity: 1; transform: translate(0, 0) rotate(0) scale(1); }
        }
        .leaf-letter {
          display: inline-block; opacity: 0;
          transform-origin: 50% 80%; will-change: opacity, transform;
        }
        .landing-reveal--visible .leaf-letter {
          animation: leafFlutterIn 760ms cubic-bezier(0.22, 1, 0.36, 1) var(--leaf-delay) both;
        }

        /* ── Typewriter ── */
        @keyframes typewriterCharacter { to { opacity: 1; } }
        .principles-typewriter-letter { display: inline-block; opacity: 0; }
        .principles-typewriter-active .principles-typewriter-letter,
        .confidence-typewriter-active .principles-typewriter-letter {
          animation: typewriterCharacter 1ms linear var(--typewriter-delay) forwards;
        }

        /* ── Confidence scan line ── */
        @keyframes confidenceScan {
          0%, 12% { top: -72px; opacity: 0; }
          18%      { opacity: 1; }
          82%      { opacity: 1; }
          88%, 100%{ top: calc(100% + 72px); opacity: 0; }
        }
        .confidence-scan-section { position: relative; overflow: hidden; isolation: isolate; }
        .confidence-scan-section::before {
          content: ''; position: absolute; z-index: 2; top: -72px; left: 0;
          width: 100%; height: 72px; pointer-events: none;
          background: linear-gradient(
            to bottom,
            transparent 0%, rgba(59,178,246,0.025) 38%,
            rgba(239,68,68,0.13) 49%, rgba(239,68,68,0.55) 50%,
            rgba(239,68,68,0.13) 51%, rgba(59,178,246,0.025) 62%, transparent 100%
          );
          filter: drop-shadow(0 0 10px rgba(239,68,68,0.28));
          animation: confidenceScan 4.8s linear infinite;
          will-change: top, opacity;
        }
        .confidence-layout { display: flex; align-items: flex-start; gap: 64px; flex-wrap: wrap; }

        /* ── Feature cards ── */
        .features-golden-hover {
          position: relative; transform: translateY(0);
          transition: background-color 220ms ease, border-color 220ms ease, box-shadow 260ms ease, transform 260ms cubic-bezier(0.22,1,0.36,1);
        }
        .features-golden-hover:hover {
          background-color: #F59E0B !important; border-color: rgba(245,158,11,0.9) !important;
          box-shadow: 0 18px 44px rgba(0,0,0,0.32), 0 0 0 1px rgba(245,158,11,0.24), 0 0 32px rgba(245,158,11,0.2);
          transform: translateY(-4px);
        }
        .golden-feature-card, .golden-feature-card-selected {
          position: relative; z-index: 1; transform: translateY(0);
          transition: background-color 200ms ease, box-shadow 240ms ease, transform 240ms cubic-bezier(0.22,1,0.36,1) !important;
        }
        .golden-feature-card:hover, .golden-feature-card-selected:hover {
          background: linear-gradient(145deg, #1F2534, #211D16) !important;
          box-shadow: inset 0 0 0 1px rgba(245,158,11,0.72), 0 14px 28px rgba(0,0,0,0.28), 0 0 22px rgba(245,158,11,0.16);
          transform: translateY(-5px); z-index: 3;
        }
        .golden-feature-card:hover > div:nth-child(2),
        .golden-feature-card-selected:hover > div:nth-child(2) { color: #FBBF24 !important; }

        /* Shimmer sweep on feature cards */
        .feature-card-shimmer::before {
          content: '';
          position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%);
          transform: skewX(-18deg);
          transition: left 0.6s ease;
          pointer-events: none;
        }
        .feature-card-shimmer:hover::before { left: 160%; }

        /* ── Stats scanline ── */
        @keyframes statsScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100vw); }
        }
        .stats-scanline {
          position: absolute; top: 0; left: 0; width: 200px; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(239,68,68,0.04), transparent);
          animation: statsScan 6s linear infinite;
          pointer-events: none;
        }

        /* Stat item hover */
        .stat-item {
          transition: transform 0.2s cubic-bezier(0.22,1,0.36,1);
          cursor: default;
        }
        .stat-item:hover { transform: translateY(-4px); }

        /* ── CTA orbit rings ── */
        @keyframes orbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .cta-orbit-ring {
          position: absolute; top: 50%; left: 50%;
          width: 420px; height: 420px; border-radius: 50%;
          border: 1px solid rgba(239,68,68,0.07);
          pointer-events: none;
          animation: orbitSpin 22s linear infinite;
        }
        .cta-orbit-ring::after {
          content: '';
          position: absolute; top: -3px; left: 50%;
          width: 6px; height: 6px; border-radius: 50%;
          background: #EF4444; opacity: 0.6;
          transform: translateX(-50%);
        }
        .cta-orbit-ring--2 {
          width: 300px; height: 300px;
          border-color: rgba(59,178,246,0.06);
          animation-duration: 15s;
          animation-direction: reverse;
        }
        .cta-orbit-ring--2::after { background: #3BB2F6; }

        /* ── Principles rows ── */
        .principle-hover-row {
          position: relative; border-radius: 8px; transform: translateX(0);
          transition: background-color 200ms ease, box-shadow 220ms ease, transform 220ms cubic-bezier(0.22,1,0.36,1);
        }
        .principle-hover-row:hover {
          background: linear-gradient(90deg, rgba(239,68,68,0.09), rgba(30,41,59,0.5) 58%, transparent);
          box-shadow: inset 2px 0 0 #EF4444, 0 10px 26px rgba(0,0,0,0.14);
          transform: translateX(7px);
        }
        .principle-hover-row > div:first-child,
        .principle-hover-row > div:nth-child(2) > div { transition: color 200ms ease; }
        .principle-hover-row:hover > div:first-child { color: #EF4444 !important; }
        .principle-hover-row:hover > div:nth-child(2) > div { color: #FFFFFF !important; }

        /* ── Reveal ── */
        .landing-reveal {
          opacity: 0; transform: translateY(36px);
          transition: opacity 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1);
          will-change: opacity, transform;
        }
        .landing-reveal--visible { opacity: 1; transform: translateY(0); }

        /* ── Pop buttons ── */
        .landing-pop-button {
          transform: translateY(0) scale(1);
          transition:
            color 180ms ease, background-color 180ms ease, border-color 180ms ease,
            box-shadow 220ms ease, transform 220ms cubic-bezier(0.22,1,0.36,1) !important;
          will-change: transform;
        }
        .landing-pop-button:hover {
          transform: translateY(-3px) scale(1.035);
          box-shadow: 0 10px 24px rgba(0,0,0,0.28), 0 0 18px rgba(239,68,68,0.14);
        }
        .landing-pop-button:active { transform: translateY(-1px) scale(0.985); }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .landing-nav { padding: 8px 16px; gap: 12px; height: auto; min-height: 56px; flex-wrap: wrap; }
          .landing-nav-links { display: none; }
          .landing-nav-forward { display: none !important; }
          .landing-nav-actions { display: flex; gap: 8px; align-items: center; }
          .hero-inner { padding: 0 4px; }
          .confidence-layout { flex-direction: column; gap: 32px; }
          .principle-row-responsive { flex-wrap: wrap; gap: 8px !important; }
          .principle-row-responsive > div:nth-child(3) { width: 100%; padding-left: 36px; }
          .cta-orbit-ring { width: 280px; height: 280px; }
          .cta-orbit-ring--2 { width: 200px; height: 200px; }
          .score-demo-bar { flex-wrap: wrap; justify-content: center; }
        }
        @media (max-width: 480px) {
          .landing-nav-actions button:first-child { display: none; }
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .landing-background-animated,
          .logo-icon,
          .cta-pulse-btn::before,
          .grid-drift,
          .shape-orbit,
          .shape-pulse,
          .score-demo-bar,
          .stats-scanline,
          .cta-orbit-ring,
          .cta-orbit-ring--2,
          .radar-ring { animation: none !important; }

          .landing-reveal, .landing-reveal--visible { opacity: 1; transform: none; transition: none; }
          .landing-pop-button { transition: none !important; }
          .landing-pop-button:hover, .landing-pop-button:active { transform: none; }
          .leaf-letter, .landing-reveal--visible .leaf-letter { opacity: 1; transform: none; animation: none; }
          .principles-typewriter-letter,
          .principles-typewriter-active .principles-typewriter-letter { opacity: 1; animation: none; }
          .confidence-scan-section::before { display: none; }
          .features-golden-hover { transition: none; }
          .features-golden-hover:hover { transform: none; }
          .golden-feature-card, .golden-feature-card-selected { transition: none !important; }
          .golden-feature-card:hover, .golden-feature-card-selected:hover { transform: none; }
          .principle-hover-row { transition: none; }
          .principle-hover-row:hover { transform: none; }
          .glitch-text:hover::before, .glitch-text:hover::after { display: none; }
        }
      `}</style>
    </div>
  );
}
