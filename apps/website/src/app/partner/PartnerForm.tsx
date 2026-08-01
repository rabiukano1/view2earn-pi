"use client";

import { useState } from "react";
import { useInquiryForm } from "@/components/useInquiryForm";

export function PartnerForm() {
  const { busy, error, done, submit } = useInquiryForm("partner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState("");
  const [message, setMessage] = useState("");

  if (done) {
    return (
      <div className="form-page">
        <div className="container">
          <div className="form-card">
            <div className="form-success">
              <div className="check">✓</div>
              <h3>Request received!</h3>
              <p>
                Thanks for your interest in partnering with View2Earn. Our team
                will reach out to <strong>{email}</strong> shortly.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="container">
        <div className="form-card">
          <h1>Partner with View2Earn</h1>
          <p className="form-sub">
            Want to list your page or channel as a task, or run rewarded ads to
            an active audience? Tell us about yourself and we&apos;ll be in touch.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit({ name, email, company, platform, message });
            }}>
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor="name">
                  Your name <span className="req">*</span>
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="field">
                <label htmlFor="company">Company / brand</label>
                <input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Optional"
                  maxLength={200}
                />
              </div>
            </div>
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor="email">
                  Email <span className="req">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="platform">Interested in</label>
                <select
                  id="platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="pi">Pi Network audience</option>
                  <option value="sidra">Sidra Chain audience</option>
                  <option value="both">Both ecosystems</option>
                  <option value="ads">Running rewarded ads</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="message">
                Tell us more <span className="req">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What would you like to promote or partner on?"
                required
                minLength={10}
                maxLength={5000}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%" }}>
              {busy ? "Sending…" : "Send request"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
