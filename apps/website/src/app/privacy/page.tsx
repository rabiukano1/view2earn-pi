import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
};

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>Privacy policy</h1>
        <p className="legal-updated">Last updated: July 2026</p>

        <p>
          View2Earn ("we", "us", "our") operates a task-and-reward platform on
          the Pi Network and Sidra Chain. This policy explains what information
          we collect, why we collect it, and how we protect it.
        </p>

        <h2>1. Information we collect</h2>
        <p>
          We collect only what is needed to operate the platform:
        </p>
        <ul>
          <li>
            <strong>Account information</strong> — your ecosystem (Pi or
            Sidra), external user identifier, username and country, created at
            sign-up.
          </li>
          <li>
            <strong>Activity data</strong> — task completions, points earned
            and redeemed, referral relationships, quiz results and app wallet
            transactions.
          </li>
          <li>
            <strong>Device signals</strong> — limited device and network
            fingerprints (canvas, audio, hardware and IP characteristics) used
            exclusively to detect fraud and abuse.
          </li>
          <li>
            <strong>Contact information</strong> — name and email you provide
            when you contact us or submit a partner request.
          </li>
        </ul>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To operate, verify and secure the reward platform.</li>
          <li>To prevent fraud, abuse and multiple-account exploitation.</li>
          <li>To respond to your messages and partner requests.</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2>3. What we never do</h2>
        <ul>
          <li>We never store your Pi or Sidra secret phrase, seed or private keys.</li>
          <li>We never sell your personal data to third parties.</li>
          <li>
            We never display follower or friend counts to other users — that
            data is not collected for display.
          </li>
        </ul>

        <h2>4. Data sharing</h2>
        <p>
          We share data only with the service providers necessary to run the
          platform (hosting, authentication, reward fulfilment and ad
          networks), and only to the extent required. We never transfer funds
          or data across the Pi and Sidra economies — they are fully isolated.
        </p>

        <h2>5. Data retention & your rights</h2>
        <p>
          We keep data only as long as needed for the purposes above. You may
          contact us to request access, correction or deletion of your personal
          information. See the Contact section below.
        </p>

        <h2>6. Children</h2>
        <p>
          View2Earn is not directed to children under 18, and we do not
          knowingly collect data from them.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy questions, contact us through the contact form on this
          site or by email at support@view2earn.org.
        </p>
      </div>
    </div>
  );
}
