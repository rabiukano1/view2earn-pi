import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <span className="brand-mark">V</span>
              <span>View2Earn</span>
            </div>
            <p className="footer-desc">
              A social-engagement and rewards platform on Pi Network and Sidra
              Chain. Earn points for following, liking and joining — then redeem
              them for real rewards.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/#features">Features</Link>
            <Link href="/#roadmap">What&apos;s next</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#faq">FAQ</Link>
            <Link href="/#download">Download</Link>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <Link href="/contact">Contact us</Link>
            <Link href="/partner">Partner with us</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/cookies">Cookie policy</Link>
            <Link href="/anti-fraud">Anti-fraud policy</Link>
            <Link href="/rewards-redemption">Rewards &amp; redemption</Link>
          </div>
          <div className="footer-col">
            <h4>Follow</h4>
            <a href="https://t.me/view2earn" target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            <a href="https://x.com/view2earn" target="_blank" rel="noopener noreferrer">
              X (Twitter)
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} View2Earn. All rights reserved.</span>
          <span>Pi Network · Sidra Chain · Rewards for your engagement</span>
        </div>
      </div>
    </footer>
  );
}
