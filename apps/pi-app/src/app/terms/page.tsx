import type { Metadata } from "next";
import { PiTermsPage } from "@/pi/components/PiTermsPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Official Terms of Service and User Agreement for View2Earn digital engagement and rewards platform.",
};

export default function TermsPage() {
  return <PiTermsPage />;
}
