import type { Metadata } from "next";
import { PiPolicyPage } from "@/pi/components/PiPolicyPage";

export const metadata: Metadata = {
  title: "Rewards & Redemption Policy",
  description: "Official Rewards & Redemption Policy for View2Earn digital engagement and rewards platform.",
};

export default function RewardsRedemptionPage() {
  return <PiPolicyPage policy="rewards" />;
}
