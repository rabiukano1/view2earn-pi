import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand" style={{ gap: '14px' }}>
          <img src="/icon.png" alt="View2Earn Logo" className="brand-mark-img" width={60} height={60} style={{ borderRadius: '13px', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em' }}>View2Earn</span>
        </Link>
        <nav className="site-nav">
          <Link href="/#live">Live</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#roadmap">What&apos;s next</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/partner">For partners</Link>
          <a href="https://github.com/rabiukano1/view2earn-pi/releases/download/v1.0.0/view2earn.apk" download className="btn btn-primary btn-sm nav-cta">
            Download APK
          </a>
        </nav>
      </div>
    </header>
  );
}
