import type { Metadata } from "next";
import { PiPolicyPage } from "@/pi/components/PiPolicyPage";

export const metadata: Metadata = {
  title: "Anti-Fraud Policy",
  description: "Official Anti-Fraud Policy for View2Earn digital engagement and rewards platform.",
};

export default function AntiFraudPage() {
  return <PiPolicyPage policy="anti-fraud" />;
}
