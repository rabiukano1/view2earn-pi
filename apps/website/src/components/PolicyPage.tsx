import type { PolicyKey } from "@view2earn/core";
import { getPolicyDoc, type PolicyBlock } from "@view2earn/core";

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
        <p className="text-slate-300 text-sm leading-relaxed mb-3">{block.x}</p>
      );
    case "l":
      return (
        <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm mb-4">
          {block.x.map((item, i) => (
            <li key={i}>{item}</li>
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
          <span className="inline-block px-3 py-1 bg-violet-500/10 text-violet-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <span className="block text-xs font-semibold text-slate-400 uppercase mb-1">General Support</span>
                <a href="mailto:support@view2earn.org" className="text-violet-400 font-medium hover:underline text-sm">support@view2earn.org</a>
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
