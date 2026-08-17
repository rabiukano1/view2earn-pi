import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account & Data Deletion - View2Earn",
  description: "Instructions on how to request account and data deletion for your View2Earn profile.",
  alternates: {
    canonical: "https://view2earn.org/delete-account",
  },
};

export default function DeleteAccountPage() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>Account &amp; Data Deletion</h1>
        <div className="legal-updated">Last Updated: August 2026</div>

        <h2>How to Delete Your Account</h2>
        <p>
          The fastest way to permanently delete your account is directly within the View2Earn application:
        </p>
        <ol>
          <li>Open the View2Earn application on your device.</li>
          <li>Navigate to the <strong>Security &amp; Settings</strong> screen.</li>
          <li>Tap the <strong>Delete Account</strong> button at the bottom of the screen.</li>
          <li>Confirm the deletion when prompted. Your account will be immediately signed out and deleted.</li>
        </ol>

        <h2>Web Deletion Request</h2>
        <p>
          If you no longer have access to the app, you can request account deletion by contacting our support team. Please email us from the email address associated with your account or provide your exact username for verification.
        </p>
        <p>
          Email: <a href="mailto:support@view2earn.org" style={{ color: "var(--accent)", fontWeight: 600 }}>support@view2earn.org</a>
        </p>
        <p>
          Or use our <Link href="/contact" style={{ color: "var(--accent)", textDecoration: "underline" }}>Contact Form</Link> to submit a request.
        </p>

        <h2>What Happens When You Delete Your Account?</h2>
        <p>Account deletion is a permanent and irreversible action.</p>
        <ul>
          <li>Your profile, username, and authentication data will be permanently removed.</li>
          <li>All earned points, pending rewards, and redemption history will be permanently forfeited.</li>
          <li>Any linked social accounts or wallet addresses will be unlinked.</li>
        </ul>

        <h2>Data Retention Policy</h2>
        <p>
          While your account and personal profile data are deleted upon request, View2Earn is legally required to retain certain records for security, fraud prevention, and accounting purposes:
        </p>
        <ul>
          <li><strong>Fraud Prevention:</strong> Device fingerprints, IP addresses, and records of fraudulent activity may be securely retained to prevent banned users from creating new accounts.</li>
          <li><strong>Financial Records:</strong> Records of successful point redemptions, payouts, or cryptocurrency withdrawals are retained to comply with financial and tax regulations.</li>
          <li><strong>Anonymized Analytics:</strong> Aggregated, non-identifiable usage statistics are retained for system performance monitoring.</li>
        </ul>
        <p>
          For more details on how we handle your data, please review our <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
