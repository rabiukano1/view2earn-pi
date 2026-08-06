import type { Metadata } from "next";
import { PolicyPageContent } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Rewards & Redemption Policy - View2Earn",
  description: "Official Rewards & Redemption Policy for View2Earn digital engagement and rewards platform.",
};

export default function RewardsRedemptionPage() {
  return <PolicyPageContent policy="rewards" />;
}
