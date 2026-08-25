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
              them for digital rewards and perks.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="https://play.google.com/store/apps/details?id=com.view2earn" target="_blank" rel="noopener noreferrer">
              Google Play Store ↗
            </a>
            <a href="https://github.com/rabiukano1/view2earn-pi/releases/download/v1.0.0/view2earn.apk" download>
              Download APK (Android)
            </a>
            <span style={{ display: "block", padding: "6px 0", fontSize: "14.5px", color: "#6f6890" }}>
              iOS App Store <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "999px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" }}>Soon</span>
            </span>
            <Link href="/#features">Features</Link>
            <Link href="/#roadmap">What&apos;s next</Link>
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#faq">FAQ</Link>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <Link href="/contact">Contact us</Link>
            <Link href="/partner">Partner with us</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/delete-account">Delete account</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/child-safety">Child safety</Link>
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
