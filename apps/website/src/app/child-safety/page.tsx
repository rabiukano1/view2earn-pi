import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "View2Earn Child Safety Standards",
  description: "View2Earn's Child Safety Standards explain our commitment to protecting children and prohibiting child sexual abuse and exploitation.",
  alternates: {
    canonical: "https://view2earn.org/child-safety",
  },
};

export default function ChildSafetyPage() {
  return (
    <div className="legal-page">
      <div className="container">
        <h1>View2Earn Child Safety Standards</h1>
        <div className="legal-updated">Last Updated: August 2026</div>

        <h2>Introduction</h2>
        <p>
          View2Earn is fundamentally committed to maintaining a safe community for all users and does not tolerate any behavior that endangers minors. We strictly prohibit child sexual abuse or exploitation in any form.
        </p>
        <p>To ensure a secure environment, View2Earn expressly prohibits:</p>
        <ul>
          <li>Child Sexual Abuse and Exploitation (CSAE)</li>
          <li>Child Sexual Abuse Material (CSAM)</li>
          <li>Grooming or any predatory behavior directed toward children</li>
          <li>The sexual exploitation of minors</li>
          <li>The solicitation or facilitation of the sexual exploitation of children</li>
          <li>Any content, communications, or behavior that facilitates the abuse, harm, or exploitation of children</li>
        </ul>

        <h2>Zero-Tolerance Policy</h2>
        <p>
          View2Earn operates with a strict <strong>zero-tolerance policy</strong> regarding Child Sexual Abuse and Exploitation (CSAE) and Child Sexual Abuse Material (CSAM).
        </p>
        <p>
          Users must not under any circumstances create, upload, publish, share, request, promote, distribute, or facilitate any prohibited content or behavior involving children on the View2Earn platform. Any violation of this policy is grounds for immediate, permanent account termination and referral to appropriate legal authorities.
        </p>

        <h2>User Reporting</h2>
        <p>
          Protecting our community requires vigilance from all users. If you encounter any content, accounts, or behavior on View2Earn that raises child safety concerns, suspected CSAE, or suspected CSAM, please report it immediately.
        </p>
        <p>
          You can report any accounts or content that may endanger children by contacting us directly via our dedicated safety email address, or by using our web contact form:
        </p>
        <ul>
          <li><Link href="/contact" style={{ color: "var(--accent)", textDecoration: "underline" }}>Web Contact Form</Link></li>
          <li>Email: <a href="mailto:support@view2earn.org" style={{ color: "var(--accent)", fontWeight: 600 }}>support@view2earn.org</a></li>
        </ul>
        <p>
          <em>Note: We are actively developing native in-app reporting tools which will be available in a future update to allow for immediate reporting without leaving the application.</em>
        </p>

        <h2>Enforcement Actions</h2>
        <p>
          View2Earn will take decisive and appropriate action when we become aware of prohibited child-safety content or behavior. These actions may include, but are not limited to:
        </p>
        <ul>
          <li>Removing the prohibited content from the platform</li>
          <li>Restricting or suspending the offending user's account</li>
          <li>Permanently terminating accounts where appropriate</li>
          <li>Preserving relevant information and evidence where legally required</li>
          <li>Cooperating with lawful investigations and reporting incidents to the appropriate authorities</li>
        </ul>

        <h2>Child Safety Contact</h2>
        <p>
          For any matters regarding child safety concerns, or for Google Play-related notifications concerning CSAE/CSAM, please use our designated contact:
        </p>
        <p>
          <a href="mailto:support@view2earn.org" style={{ color: "var(--accent)", fontWeight: 600 }}>support@view2earn.org</a>
        </p>

        <h2>Legal and Regulatory Compliance</h2>
        <p>
          View2Earn is committed to complying with all applicable child-safety laws and regulations in the jurisdictions where our service operates. We actively review our policies and procedures to ensure we maintain the necessary requirements to help protect children online.
        </p>

        <h2>Community Standards</h2>
        <p>
          All users are expected to follow View2Earn's <Link href="/terms" style={{ color: "var(--accent)", textDecoration: "underline" }}>Terms of Service</Link>, Community Guidelines, and applicable laws. Participation in our ecosystem is conditional upon maintaining a safe environment for everyone, and any behavior that threatens the safety or well-being of others, especially children, is strictly prohibited.
        </p>
      </div>
    </div>
  );
}
