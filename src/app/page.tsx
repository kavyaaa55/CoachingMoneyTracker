import { redirect } from "next/navigation";
import { homeFor } from "@/domain/access";
import { currentUser } from "@/lib/auth";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
