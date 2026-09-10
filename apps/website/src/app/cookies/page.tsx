import type { Metadata } from "next";
import { PolicyPageContent } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Cookie Policy - View2Earn",
  description: "Official Cookie Policy for View2Earn digital engagement and rewards platform.",
};

export default function CookiesPage() {
  return <PolicyPageContent policy="cookies" />;
}
