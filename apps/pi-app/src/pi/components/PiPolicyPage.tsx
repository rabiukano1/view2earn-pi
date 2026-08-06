import type { PolicyKey } from "@view2earn/core";
import { getPolicyDoc, type PolicyBlock } from "@view2earn/core";

function Block({ block }: { block: PolicyBlock }) {
  switch (block.t) {
    case "h":
      return <h2 className="pi-policy-h">{block.x}</h2>;
    case "s":
      return <h3 className="pi-policy-s">{block.x}</h3>;
    case "p":
      return <p className="pi-policy-p">{block.x}</p>;
    case "l":
      return (
        <ul className="pi-policy-list">
          {block.x.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export function PiPolicyPage({ policy }: { policy: PolicyKey }) {
  const doc = getPolicyDoc(policy);
  return (
    <div className="pi-policy">
      <div className="pi-policy-head">
        <span className="pi-policy-badge">{doc.badge}</span>
        <h1 className="pi-policy-title">{doc.title}</h1>
        <p className="pi-policy-updated">Last Updated: {doc.lastUpdated}</p>
      </div>

      <div className="pi-policy-body">
        <section className="pi-policy-card">
          {doc.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>

        <section className="pi-policy-card">
          <h2 className="pi-policy-h">Contact Information</h2>
          <p className="pi-policy-p">
            For any questions or legal notices regarding this document, please reach
            out via our official communication channels:
          </p>
          <div className="pi-policy-contact">
            <div className="pi-policy-contact-card">
              <span className="pi-policy-contact-label">General Support</span>
              <a href="mailto:support@view2earn.org" className="pi-policy-contact-mail">
                support@view2earn.org
              </a>
            </div>
            <div className="pi-policy-contact-card">
              <span className="pi-policy-contact-label">Legal Notices</span>
              <a href="mailto:legal@view2earn.org" className="pi-policy-contact-mail">
                legal@view2earn.org
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
