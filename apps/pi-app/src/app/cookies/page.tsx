import type { Metadata } from "next";
import { PiPolicyPage } from "@/pi/components/PiPolicyPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Official Cookie Policy for View2Earn digital engagement and rewards platform.",
};

export default function CookiesPage() {
  return <PiPolicyPage policy="cookies" />;
}
