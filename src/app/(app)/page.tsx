import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CollectionShell } from "@/components/collection-shell";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Fetch card names/codes mentioned in recent intel items for cross-linking
  const { data: intelItems } = await supabase
    .from("intel_items")
    .select("card_names")
    .order("fetched_at", { ascending: false })
    .limit(200);

  const intelCardNames = new Set<string>();
  (intelItems ?? []).forEach((item) => {
    (item.card_names ?? []).forEach((name: string) => {
      intelCardNames.add(name.toUpperCase());
      intelCardNames.add(name.toLowerCase());
    });
  });

  return (
    <CollectionShell
      initialCollections={collections ?? []}
      intelCardNames={[...intelCardNames]}
    />
  );
}
