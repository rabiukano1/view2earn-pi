import type { Metadata } from "next";
import { PolicyPageContent } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy - View2Earn",
  description: "Official Privacy Policy for View2Earn digital engagement and rewards platform.",
};

export default function PrivacyPage() {
  return <PolicyPageContent policy="privacy" />;
}
