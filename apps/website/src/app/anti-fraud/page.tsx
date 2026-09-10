import type { Metadata } from "next";
import { PolicyPageContent } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Anti-Fraud Policy - View2Earn",
  description: "Official Anti-Fraud Policy for View2Earn digital engagement and rewards platform.",
};

export default function AntiFraudPage() {
  return <PolicyPageContent policy="anti-fraud" />;
}
