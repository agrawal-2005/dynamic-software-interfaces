import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

/* ─── design tokens ──────────────────────────────────────────────────────── */
const PAGE_STYLES = `
  :root {
    --ink:   #0b0d12;
    --panel: #12151d;
    --rim:   rgba(255,255,255,0.07);
    --violet:#7c5cff;
    --cyan:  #3ad1c6;
    --amber: #f5a623;
    --rose:  #ff4e6a;
    --text:  #dde1ea;
    --muted: #5a6070;
    --dim:   #2a2f3d;
  }
  .lp-root { background:var(--ink); color:var(--text); font-family:inherit; }
  .lp-root * { box-sizing:border-box; }

  /* typography helpers */
  .display-1 {
    font-size: clamp(2.4rem, 5.5vw, 4.2rem);
    font-weight: 780;
    letter-spacing: -0.035em;
    line-height: 1.06;
  }
  .display-2 {
    font-size: clamp(1.7rem, 3.5vw, 2.8rem);
    font-weight: 720;
    letter-spacing: -0.03em;
    line-height: 1.12;
  }
  .mono { font-family: ui-monospace, 'Cascadia Code', 'Fira Mono', monospace; }

  /* chip */
  .chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 5px 10px 5px 12px;
    background: var(--panel);
    border: 1px solid var(--rim);
    border-radius: 999px;
    font-size: 12px; font-family: ui-monospace, monospace;
    color: #9ba3b6;
    white-space: nowrap;
  }
  .chip-tag {
    padding: 1px 7px; border-radius: 999px;
    font-size: 10px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
  }

  /* glass card */
  .g-card {
    background: var(--panel);
    border: 1px solid var(--rim);
    border-radius: 16px;
  }

  /* nav link */
  .nav-link {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 13px; transition: color .2s;
    font-family: inherit; padding: 0;
  }
  .nav-link:hover { color: var(--text); }

  /* primary btn */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; border-radius: 10px;
    background: var(--violet); color: #fff;
    font-size: 13px; font-weight: 650; border: none; cursor: pointer;
    transition: background .2s, transform .1s;
  }
  .btn-primary:hover  { background: #9174ff; }
  .btn-primary:active { transform: scale(.97); }

  /* ghost btn */
  .btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; border-radius: 10px;
    background: rgba(255,255,255,.04);
    border: 1px solid var(--rim); color: #9ba3b6;
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: border-color .2s, color .2s;
    font-family: inherit;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,.18); color: var(--text); }

  /* gradient text */
  .grad-text {
    background: linear-gradient(115deg, var(--violet) 0%, var(--cyan) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* demo chrome */
  .demo-wrap { border-radius: 18px; overflow: hidden; border: 1px solid var(--rim); box-shadow: 0 40px 100px rgba(0,0,0,.6); }
  .demo-chrome {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px;
    background: #0f1219;
    border-bottom: 1px solid var(--rim);
  }
  .traffic { display: flex; gap: 6px; }
  .traffic span { width:11px; height:11px; border-radius:50%; display:block; }
  .demo-url {
    flex: 1; display: flex; justify-content: center;
  }
  .demo-url-inner {
    background: rgba(255,255,255,.05); border-radius: 7px;
    padding: 4px 12px; display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-family: ui-monospace, monospace; color: #5a6070;
    max-width: 360px; width: 100%;
  }
  .live-badge {
    display: flex; align-items: center; gap: 5px;
    background: rgba(58,209,198,.1); border: 1px solid rgba(58,209,198,.25);
    border-radius: 999px; padding: 2px 9px;
    font-size: 10px; font-weight: 700; color: var(--cyan); letter-spacing:.04em;
    text-transform: uppercase;
  }

  /* step number */
  .step-n {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    font-family: ui-monospace, monospace;
    letter-spacing: .04em;
    background: rgba(124,92,255,.1); border: 1px solid rgba(124,92,255,.2);
    color: var(--violet);
  }

  /* pulse */
  @keyframes pulse-dot {
    0%,100% { opacity:1; }
    50%      { opacity:.4; }
  }
  .pulse { animation: pulse-dot 1.8s ease-in-out infinite; }

  /* section overline */
  .overline {
    font-size: 11px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    color: var(--violet); font-family: ui-monospace, monospace;
    margin-bottom: 12px;
  }

  @media (max-width: 640px) {
    .desktop-links { display: none !important; }
  }
`;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      transition: 'all .3s',
      background: scrolled ? 'rgba(11,13,18,.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : undefined,
      borderBottom: scrolled ? '1px solid rgba(255,255,255,.07)' : '1px solid transparent',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Brand */}
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <LogoMark size={28} />
          <span style={{ fontWeight: 750, color: '#e8eaf0', fontSize: 15, letterSpacing: '-.025em' }}>Dynamically</span>
        </button>

        {/* Desktop links */}
        <div className="desktop-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {[
            { label: 'Live demo', id: 'demo' },
            { label: 'How it works', id: 'how' },
            { label: "Who it's for", id: 'who' },
          ].map(({ label, id }) => (
            <button key={id} className="nav-link" onClick={() => scrollToId(id)}>{label}</button>
          ))}
        </div>

        {/* CTA */}
        <button className="btn-primary" onClick={() => scrollToId('demo')} style={{ padding: '8px 16px' }}>
          Try it
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </button>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  const navigate = useNavigate();
  return (
    <section style={{ position: 'relative', paddingTop: 130, paddingBottom: 60, overflow: 'hidden' }}>

      {/* Glow blobs */}
      <div aria-hidden style={{ pointerEvents: 'none', position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,92,255,.13) 0%, transparent 70%)', filter: 'blur(40px)', marginTop: -100 }} />
      </div>
      <div aria-hidden style={{ pointerEvents: 'none', position: 'absolute', right: '10%', top: '20%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(58,209,198,.08) 0%, transparent 70%)', filter: 'blur(50px)' }} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', textAlign: 'center', position: 'relative' }}>

        {/* Overline badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', fontSize: 11, color: '#5a6070', marginBottom: 32, fontFamily: 'ui-monospace, monospace' }}>
          <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ad1c6', display: 'inline-block' }} />
          your data · your view · no code needed
        </div>

        {/* Headline */}
        <h1 className="display-1" style={{ color: '#e8eaf0', marginBottom: 20, marginTop: 0 }}>
          Any team. Any data.<br />
          <span className="grad-text">Your interface.</span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#5a6070', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 36px', fontWeight: 400 }}>
          Tell the dashboard what you want to see — in plain English. It shapes itself around you.
          Same data, completely different interface for every person on the team.
        </p>

        {/* Spec annotation */}
        <div className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#3a3f50', marginBottom: 36, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(18,21,29,.8)' }}>
          <span style={{ color: '#7c5cff' }}>spec</span>
          <span style={{ color: '#2a2f3d' }}>›</span>
          <span>layout = <span style={{ color: '#3ad1c6' }}>kanban</span></span>
          <span style={{ color: '#2a2f3d' }}>·</span>
          <span>grouped by <span style={{ color: '#f5a623' }}>status</span></span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button className="btn-primary" onClick={() => scrollToId('demo')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Try the live demo
          </button>
          <button className="btn-ghost" onClick={() => navigate('/engineering')}>
            Open full app
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Suggestion chips (static visual) ──────────────────────────────────────────
const CHIPS: { label: string; tag: string; color: string }[] = [
  { label: 'show only critical',       tag: 'filter', color: '#ff4e6a' },
  { label: 'group by assignee',        tag: 'group',  color: '#7c5cff' },
  { label: 'rename in‑progress → Doing', tag: 'rename', color: '#3ad1c6' },
  { label: 'hide done items',          tag: 'filter', color: '#ff4e6a' },
  { label: 'switch to card view',      tag: 'layout', color: '#f5a623' },
  { label: 'sort by priority desc',    tag: 'sort',   color: '#7c5cff' },
];

function ChipsDisplay() {
  return (
    <div style={{ padding: '20px 24px 16px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <p className="mono" style={{ fontSize: 10, color: '#3a3f50', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.1em' }}>// try describing a view:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {CHIPS.map((c) => (
          <span key={c.label} className="chip">
            {c.label}
            <span className="chip-tag" style={{ background: c.color + '22', color: c.color }}>
              {c.tag}
            </span>
          </span>
        ))}
      </div>
      <div className="mono" style={{ marginTop: 14, fontSize: 11, color: '#2a2f3d', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#7c5cff' }}>spec</span>
        <span>›</span>
        <span>layout = <span style={{ color: '#3ad1c6' }}>kanban</span></span>
        <span>·</span>
        <span>grouped by <span style={{ color: '#f5a623' }}>status</span></span>
        <span>·</span>
        <span style={{ color: '#ff4e6a' }}>3 filters</span>
      </div>
    </div>
  );
}

// ── Demo ──────────────────────────────────────────────────────────────────────
function Demo() {
  return (
    <section id="demo" style={{ padding: '0 16px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        <p className="mono" style={{ textAlign: 'center', fontSize: 10, color: '#3a3f50', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 20 }}>
          // live demo — real app, not a mockup
        </p>

        <div className="demo-wrap">

          {/* Chrome bar */}
          <div className="demo-chrome">
            <div className="traffic">
              <span style={{ background: '#ff5f57' }} />
              <span style={{ background: '#ffbd2e' }} />
              <span style={{ background: '#28ca41' }} />
            </div>

            <div className="demo-url">
              <div className="demo-url-inner">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3a3f50', flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>dynamically.app</span>
                <span style={{ color: '#2a2f3d', margin: '0 2px' }}>·</span>
                <span style={{ color: '#4a5060' }}>Meridian · Dashboard</span>
              </div>
            </div>

            <div className="live-badge">
              <span className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#3ad1c6', display: 'inline-block' }} />
              live
            </div>
          </div>

          {/* The real app in an iframe */}
          <iframe
            src="/#/engineering"
            title="Dynamically — live demo"
            style={{ width: '100%', border: 0, display: 'block', height: 'clamp(500px, 72vh, 740px)' }}
          />

          {/* Chips strip */}
          <ChipsDisplay />
        </div>

        <p className="mono" style={{ textAlign: 'center', fontSize: 11, color: '#3a3f50', marginTop: 16 }}>
          Click the ✦ button in the corner of the app, describe a view, watch it render.
        </p>
      </div>
    </section>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    title: 'You describe it',
    body: 'Type what you want in plain English — "show only in-progress items, group by assignee" or "switch to a card grid, hide low priority." No filter panels.',
    accent: '#7c5cff',
  },
  {
    n: '02',
    title: 'AI translates it',
    body: 'A language model returns a view spec — a small JSON document saying which fields to show, which layout, which rows to hide, and how to sort.',
    accent: '#3ad1c6',
  },
  {
    n: '03',
    title: 'Backend validates it',
    body: 'The server checks the spec against the domain vocabulary. The vocabulary has only display instructions — no write operations. The AI cannot change data, even if asked.',
    accent: '#f5a623',
  },
  {
    n: '04',
    title: 'Renderer draws it',
    body: 'The validated spec goes to a layout-agnostic renderer. Kanban, table, cards, or activity feed — same engine, any domain that defines a vocabulary file.',
    accent: '#ff4e6a',
  },
];

const GUARANTEES = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    ),
    title: 'Safe by construction',
    body: "The spec vocabulary has no mutation verbs. Asking the AI to \"delete done items\" produces a filter that hides them from your view. The underlying data is untouched.",
    accent: '#3ad1c6',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M5 9v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M12 12v3"/></svg>
    ),
    title: 'One engine, any domain',
    body: 'Engineering, Product, and Finance all run the same renderer. Adding a domain is writing one vocabulary file — the engine code never changes.',
    accent: '#7c5cff',
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.15"/></svg>
    ),
    title: 'Private and reversible',
    body: "Specs are stored per person, per domain, per section. Settings shows your full history — restore any version with one click.",
    accent: '#f5a623',
  },
];

function HowItWorks() {
  return (
    <section id="how" style={{ padding: '0 24px 96px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p className="overline">How it works</p>
          <h2 className="display-2" style={{ color: '#e8eaf0', margin: 0 }}>
            From description to interface<br />in four steps
          </h2>
        </div>

        {/* Steps */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 56 }}>
          {STEPS.map(({ n, title, body, accent }) => (
            <div key={n} className="g-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div className="step-n mono" style={{ background: accent + '18', border: `1px solid ${accent}33`, color: accent }}>
                  {n}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 680, color: '#e8eaf0', margin: '0 0 8px', letterSpacing: '-.01em' }}>{title}</h3>
                  <p style={{ fontSize: 13, color: '#5a6070', lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ position: 'relative', margin: '0 0 48px' }}>
          <div style={{ position: 'absolute', inset: '50% 0 auto', borderTop: '1px solid rgba(255,255,255,.06)' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <span className="mono" style={{ background: 'var(--ink)', padding: '0 16px', fontSize: 10, color: '#3a3f50', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              three guarantees
            </span>
          </div>
        </div>

        {/* Guarantees */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {GUARANTEES.map(({ icon, title, body, accent }) => (
            <div key={title} className="g-card" style={{ padding: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: accent + '18', border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, marginBottom: 16 }}>
                {icon}
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 680, color: '#e8eaf0', margin: '0 0 8px', letterSpacing: '-.01em' }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#5a6070', lineHeight: 1.65, margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Who it's for ─────────────────────────────────────────────────────────────
const AUDIENCE = [
  {
    overline: 'For teams building products',
    headline: 'Register a domain. The rest derives itself.',
    points: [
      'Define fields, layouts, and allowed values in one vocabulary file. The AI prompt, validation rules, and renderer config are all derived from it.',
      "Each user's view is stored separately. Their customisations don't change what anyone else sees — and nothing modifies the dataset.",
      'Start with one domain. Add others without touching the engine.',
    ],
    accent: '#7c5cff',
  },
  {
    overline: 'For people using the dashboard',
    headline: 'Describe the view you want instead of configuring it.',
    points: [
      '"Only show my team\'s work." "Group by phase, hide cancelled." "Rename in-progress to Doing." Type it — it happens.',
      "Your changes survive page reload and don't affect anyone else. Settings shows a full history of every view you've described.",
      "You're reshaping how data appears to you — nothing you do changes what's stored.",
    ],
    accent: '#3ad1c6',
  },
];

function WhoItsFor() {
  return (
    <section id="who" style={{ padding: '0 24px 96px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p className="overline">Who it's for</p>
          <h2 className="display-2" style={{ color: '#e8eaf0', margin: 0 }}>Two audiences, one engine</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {AUDIENCE.map(({ overline, headline, points, accent }) => (
            <div key={overline} className="g-card" style={{ padding: 32, position: 'relative', overflow: 'hidden' }}>
              {/* Subtle glow */}
              <div aria-hidden style={{ pointerEvents: 'none', position: 'absolute', top: -80, left: -60, width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(ellipse, ${accent}14 0%, transparent 70%)`, filter: 'blur(30px)' }} />
              <div style={{ position: 'relative' }}>
                <p className="mono" style={{ fontSize: 10, color: accent + 'aa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14, marginTop: 0 }}>{overline}</p>
                <h3 style={{ fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 700, color: '#e8eaf0', marginBottom: 24, marginTop: 0, letterSpacing: '-.02em', lineHeight: 1.25 }}>{headline}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {points.map((pt, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, fontSize: 13, color: '#5a6070', lineHeight: 1.65 }}>
                      <span style={{ marginTop: 7, flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: accent + '80', display: 'inline-block' }} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function Cta() {
  const navigate = useNavigate();
  return (
    <section style={{ padding: '0 24px 80px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ position: 'relative', borderRadius: 24, border: '1px solid rgba(124,92,255,.2)', background: 'radial-gradient(ellipse at 50% 0%, rgba(124,92,255,.1) 0%, transparent 70%), var(--panel)', padding: 'clamp(40px, 6vw, 64px)', textAlign: 'center', overflow: 'hidden' }}>
          <div aria-hidden style={{ pointerEvents: 'none', position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 600px 200px at 50% 0%, rgba(124,92,255,.12) 0%, transparent 100%)' }} />
          <div style={{ position: 'relative' }}>
            <h2 className="display-2" style={{ color: '#e8eaf0', marginBottom: 16, marginTop: 0 }}>See it yourself</h2>
            <p style={{ fontSize: 15, color: '#5a6070', lineHeight: 1.7, marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>
              The demo above is the real product. Open the AI chat, describe a view, and watch it render — then switch datasets and try again.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <button className="btn-primary" onClick={() => scrollToId('demo')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Back to demo
              </button>
              <button className="btn-ghost" onClick={() => navigate('/engineering')}>
                Open full app
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <LogoMark size={22} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#5a6070' }}>Dynamically</span>
          <span style={{ color: '#2a2f3d', fontSize: 13 }}>·</span>
          <span style={{ fontSize: 13, color: '#3a3f50' }}>Open prototype</span>
        </div>
        <p className="mono" style={{ fontSize: 11, color: '#3a3f50', margin: 0 }}>
          Built with React, Gemini, TypeScript. The data never changes — only the view does.
        </p>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <>
      <style>{PAGE_STYLES}</style>
      <div className="lp-root" style={{ minHeight: '100vh', scrollBehavior: 'smooth' }}>
        <Nav />
        <main>
          <Hero />
          <Demo />
          <HowItWorks />
          <WhoItsFor />
          <Cta />
        </main>
        <Footer />
      </div>
    </>
  );
}
