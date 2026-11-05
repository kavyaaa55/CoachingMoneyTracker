import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function StaffHome() {
  await requireUser("accounts");
  redirect("/staff/dues");
}
