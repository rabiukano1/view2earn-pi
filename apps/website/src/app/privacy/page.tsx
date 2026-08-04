import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - View2Earn",
  description: "Official Privacy Policy for View2Earn digital engagement and rewards platform.",
};

export default function PrivacyPage() {
  return (
    <div className="legal-page py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-slate-200">
      <div className="container">
        <div className="text-center mb-10 pb-6 border-b border-slate-800">
          <span className="inline-block px-3 py-1 bg-violet-500/10 text-violet-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-3">
            Security &amp; Transparency
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-slate-400 text-sm mt-2">Last Updated: August 2026</p>
        </div>

        <div className="space-y-8">
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">Introduction &amp; Overview</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Welcome to View2Earn ("View2Earn," "we," "our," or "us"). We are committed to protecting your privacy and safeguarding your personal information. We believe that privacy is a fundamental part of building a secure, transparent, and trustworthy platform.
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              This Privacy Policy explains how we collect, use, store, protect, disclose, and process your personal information when you access or use the View2Earn website, mobile applications, and related services (collectively, the "Service").
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Our goal is to collect only the information necessary to provide and improve the Service, maintain platform security, prevent fraud, comply with legal obligations, and deliver a reliable experience for all users.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">2. Information We Collect</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              View2Earn collects only the information necessary to provide, secure, improve, and operate the Service.
            </p>

            <h3 className="text-md font-semibold text-white mt-4 mb-2">2.1 Account Information</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 text-sm mb-4">
              <li>Your username or display name.</li>
              <li>Your registered email address, where applicable.</li>
              <li>Your selected blockchain ecosystem (such as Pi Network or Sidra Chain).</li>
              <li>Your external user identifier or account identifier.</li>
              <li>Your country or region.</li>
              <li>Your account creation date and account status.</li>
            </ul>

            <h3 className="text-md font-semibold text-white mt-4 mb-2">2.2 Activity Information</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 text-sm mb-4">
              <li>Tasks completed, points earned, adjusted, redeemed, or forfeited.</li>
              <li>Referral relationships and referral activity.</li>
              <li>Survey participation, quiz results, and reward redemption history.</li>
              <li>Transaction records relating to eligible in-app rewards or supported wallet interactions.</li>
              <li>Fraud prevention and verification records.</li>
            </ul>

            <h3 className="text-md font-semibold text-white mt-4 mb-2">2.3 Device and Technical Information</h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 text-sm mb-4">
              <li>Device type, operating system, and browser type/version.</li>
              <li>Device identifiers and IP address (including general location).</li>
              <li>Language, time zone settings, and network information.</li>
              <li>Limited device fingerprinting signals, used solely for fraud detection and platform security.</li>
            </ul>

            <h3 className="text-md font-semibold text-white mt-4 mb-2">2.4 Information We Do Not Collect</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-2">
              To protect your privacy and security, View2Earn does not collect or store:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 text-sm">
              <li>Your Pi Network or Sidra Chain passphrase, seed phrase, or private keys.</li>
              <li>Your wallet recovery phrases.</li>
              <li>Personal messages exchanged on external platforms.</li>
              <li>Your social media follower or friend counts for public display.</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">3. How We Use Your Information</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              We use your information only for legitimate business purposes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
              <li><strong>To Provide the Service:</strong> Account management, authentication, calculating reward points, and processing redemptions.</li>
              <li><strong>To Maintain Security and Prevent Fraud:</strong> Detecting bot traffic, automated activity, multiple accounts, and investigating violations of our Terms.</li>
              <li><strong>To Improve the Service:</strong> Analyzing platform performance, fixing bugs, and developing new features.</li>
              <li><strong>To Communicate:</strong> Responding to inquiries and sending critical security or service updates.</li>
              <li><strong>Legal Compliance:</strong> Complying with applicable laws, court orders, and enforcing legal agreements.</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">4. Legal Basis for Processing</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              We process personal information under the following valid legal bases:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
              <li><strong>Performance of a Contract:</strong> Fulfilling our obligations under our Terms of Service.</li>
              <li><strong>Legitimate Interests:</strong> Protecting the Service from fraud, maintaining system integrity, and improving performance.</li>
              <li><strong>Compliance with Legal Obligations:</strong> Responding to lawful government requests or regulatory audits.</li>
              <li><strong>Consent:</strong> When you provide explicit consent for specific features or marketing communications.</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">5. How We Share Your Information</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              We do not sell, rent, or trade your personal information. We share it only in limited circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
              <li><strong>Service Providers:</strong> Cloud hosting, authentication, communication services, and fraud prevention providers acting on our behalf.</li>
              <li><strong>Advertising and Reward Partners:</strong> Survey networks and ad partners to verify participation, prevent fraud, and credit rewards.</li>
              <li><strong>Legal Requirements:</strong> Disclosing details to satisfy legal subpoenas, law enforcement requests, or protect platform safety.</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">6. Cookies &amp; Data Retention</h2>
            <h3 className="text-md font-semibold text-white mb-2">Cookies &amp; Similar Tech</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              We use essential cookies to maintain secure sessions and prevent fraud. We may use performance cookies to understand app metrics and improve functional settings. You can manage cookies via your browser or device settings.
            </p>

            <h3 className="text-md font-semibold text-white mb-2">Data Retention Policy</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              We retain personal information only as long as necessary to fulfill business purposes, resolve disputes, prevent fraud, or satisfy legal/financial obligations.
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Upon account deletion requests, we take reasonable steps to securely delete, anonymize, or destroy your data, except where we are legally required to retain it.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">7. Security &amp; International Transfers</h2>
            <h3 className="text-md font-semibold text-white mb-2">Data Security</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              We apply industry-standard security measures (including encryption, secure access controls, system monitoring, and backup procedures) to prevent unauthorized access. You are responsible for keeping your login credentials confidential.
            </p>

            <h3 className="text-md font-semibold text-white mb-2">International Data Transfers</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              We operate globally, and your information may be processed in countries other than your residence. We ensure appropriate safeguards are implemented with all trusted cloud providers and partners.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">8. Children's Privacy</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              View2Earn is not directed to children under 18. We do not knowingly collect personal information from children. If we discover a child under 18 has created an account, we will take immediate steps to delete their data.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">9. Your Privacy Rights</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Depending on your jurisdiction (such as GDPR or CCPA), you may exercise the following rights:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm mb-4">
              <li>Right to access, correct, or request the deletion of your personal data.</li>
              <li>Right to withdraw consent at any time (where processing is based on consent).</li>
              <li>Right to object to or restrict specific processing operations.</li>
              <li>Right to obtain a portable copy of your data in a structured, machine-readable format.</li>
            </ul>
            <p className="text-slate-300 text-sm leading-relaxed">
              To exercise these rights, please email us directly at <a href="mailto:privacy@view2earn.org" className="text-violet-400 font-medium hover:underline">privacy@view2earn.org</a>.
            </p>
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">10. Contact Information</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              If you have any questions, feedback, or data requests regarding this Privacy Policy, please reach out via our official communication channels:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Privacy Team</span>
                <a href="mailto:privacy@view2earn.org" className="text-violet-400 font-medium hover:underline text-sm">privacy@view2earn.org</a>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">General Support</span>
                <a href="mailto:support@view2earn.org" className="text-violet-400 font-medium hover:underline text-sm">support@view2earn.org</a>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Security Vulnerabilities</span>
                <a href="mailto:security@view2earn.org" className="text-violet-400 font-medium hover:underline text-sm">security@view2earn.org</a>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">Legal Notices</span>
                <a href="mailto:legal@view2earn.org" className="text-violet-400 font-medium hover:underline text-sm">legal@view2earn.org</a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
