"use client";

import { useState } from "react";
import { useInquiryForm } from "@/components/useInquiryForm";

export function ContactForm() {
  const { busy, error, done, submit } = useInquiryForm("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  if (done) {
    return (
      <div className="form-page">
        <div className="container">
          <div className="form-card">
            <div className="form-success">
              <div className="check">✓</div>
              <h3>Message sent!</h3>
              <p>
                Thanks for reaching out — we&apos;ll get back to you at{" "}
                <strong>{email}</strong> as soon as we can.
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
          <h1>Contact us</h1>
          <p className="form-sub">
            Questions about the app, your points, or a redemption? Send us a
            message and we&apos;ll help.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit({ name, email, message });
            }}>
            <div className="form-grid-2">
              <div className="field">
                <label htmlFor="name">
                  Name <span className="req">*</span>
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
            </div>
            <div className="field">
              <label htmlFor="message">
                Message <span className="req">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
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
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
