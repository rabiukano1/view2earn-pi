import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">V</span>
          <span>View2Earn</span>
        </Link>
        <nav className="site-nav">
          <Link href="/#live">Live</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#roadmap">What&apos;s next</Link>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/partner">For partners</Link>
          <Link href="/#download" className="btn btn-primary btn-sm nav-cta">
            Get the app
          </Link>
        </nav>
      </div>
    </header>
  );
}
