import type { Metadata } from "next";
import { PartnerForm } from "./PartnerForm";

export const metadata: Metadata = {
  title: "Partner with us",
};

export default function PartnerPage() {
  return <PartnerForm />;
}
