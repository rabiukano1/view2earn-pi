import type { ReactNode } from "react";
import type { PolicyKey } from "@view2earn/core";
import { getPolicyDoc, type PolicyBlock } from "@view2earn/core";

// Policy text is plain strings, so any address written in it renders as dead
// text. Turn every email into a real mailto link — one place, every policy page.
const EMAIL = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

function linkEmails(text: string): ReactNode[] {
  return text.split(EMAIL).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={`mailto:${part}`}>
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.t) {
    case "h":
      return (
        <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">
          {block.x}
        </h2>
      );
    case "s":
      return (
        <h3 className="text-md font-semibold text-white mt-5 mb-2">{block.x}</h3>
      );
    case "p":
      return (
        <p className="text-slate-300 text-sm leading-relaxed mb-3">{linkEmails(block.x)}</p>
      );
    case "l":
      return (
        <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm mb-4">
          {block.x.map((item, i) => (
            <li key={i}>{linkEmails(item)}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export function PolicyPageContent({ policy }: { policy: PolicyKey }) {
  const doc = getPolicyDoc(policy);
  return (
    <div className="legal-page py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-slate-200">
      <div className="container">
        <div className="text-center mb-10 pb-6 border-b border-slate-800">
          <span className="kicker">
            {doc.badge}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {doc.title}
          </h1>
          <p className="text-slate-400 text-sm mt-2">Last Updated: {doc.lastUpdated}</p>
        </div>

        <div className="space-y-8">
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            {doc.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>

          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-violet-300 mb-4 border-b border-slate-800 pb-2">
              Contact Information
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              For any questions, data requests, or legal notices regarding this document, please
              reach out via our official communication channels:
            </p>
            <div className="contact-grid">
              <div className="contact-card">
                <span className="contact-label">General Support</span>
                <a href="mailto:support@view2earn.org">support@view2earn.org</a>
              </div>
              <div className="contact-card">
                <span className="contact-label">Legal Notices</span>
                <a href="mailto:legal@view2earn.org">legal@view2earn.org</a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
