"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/api";

// Shared logic for the public contact / partner forms. Both call an
// unauthenticated Convex mutation; we keep the state here so the two pages
// stay identical in behaviour (validation, submit, success, error).
export type InquiryKind = "contact" | "partner";

export type InquiryFields = {
  name: string;
  email: string;
  company?: string;
  platform?: string;
  message: string;
};

export function useInquiryForm(kind: InquiryKind) {
  const submitContact = useMutation(api.inquiries.submitContact);
  const submitPartner = useMutation(api.inquiries.submitPartner);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (fields: InquiryFields) => {
    setBusy(true);
    setError("");
    try {
      if (kind === "contact") {
        await submitContact({
          name: fields.name,
          email: fields.email,
          message: fields.message,
        });
      } else {
        await submitPartner({
          name: fields.name,
          email: fields.email,
          company: fields.company,
          platform: fields.platform,
          message: fields.message,
        });
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, done, submit };
}
