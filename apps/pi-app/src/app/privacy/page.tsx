import type { Metadata } from "next";
import { PiPolicyPage } from "@/pi/components/PiPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Official Privacy Policy for View2Earn digital engagement and rewards platform.",
};

export default function PrivacyPage() {
  return <PiPolicyPage policy="privacy" />;
}
