import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
};

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>Terms of service</h1>
        <p className="legal-updated">Last updated: July 2026</p>

        <p>
          By using View2Earn (the "Service"), you agree to these Terms. If you
          do not agree, please do not use the Service.
        </p>

        <h2>1. Eligibility</h2>
        <p>
          You must be at least 18 years old and comply with the terms of your
          Pi Network or Sidra Chain account. One account per person.
        </p>

        <h2>2. Points and rewards</h2>
        <ul>
          <li>
            Points are not money. Points are redeemable for rewards through the
            app at the rates we publish, which may change at any time.
          </li>
          <li>
            Rewards are issued after verification and may be subject to a
            holding period to protect against fraud.
          </li>
          <li>
            We may suspend or void points and rewards for activity we
            reasonably believe is fraudulent or in breach of these Terms.
          </li>
          <li>
            Points are not transferable between users or between the Pi and
            Sidra ecosystems.
          </li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Create multiple accounts, or use automated scripts or bots.</li>
          <li>
            Falsify proof of task completion, including submitting fake
            screenshots.
          </li>
          <li>Exploit, reverse-engineer or interfere with the Service.</li>
          <li>Attempt to defraud other users, advertisers or the platform.</li>
          <li>
            Use the Service in violation of social platform, survey provider or
            reward provider terms of service.
          </li>
        </ul>

        <h2>4. Third-party services</h2>
        <p>
          The Service integrates third-party providers for surveys, rewards and
          fulfilment. We are not responsible for those providers'
          products, content or policies, and the Pi and Sidra economies remain
          fully separate.
        </p>

        <h2>5. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms. Users
          may stop using the Service at any time.
        </p>

        <h2>6. No warranties</h2>
        <p>
          The Service is provided "as is" without warranties of any kind. We do
          not guarantee a specific level of availability, points or rewards.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for
          indirect or consequential damages arising from your use of the
          Service.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update these Terms from time to time. Continued use of the
          Service after changes are posted constitutes acceptance.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about these Terms? Contact us through the contact form on
          this site or at support@view2earn.org.
        </p>
      </div>
    </div>
  );
}
