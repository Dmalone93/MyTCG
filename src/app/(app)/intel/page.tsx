import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntelFeed } from "@/components/intel-feed";

export const revalidate = 300; // 5 minutes stale-while-revalidate

export default async function IntelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch intel items (newest first)
  const { data: items } = await supabase
    .from("intel_items")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(100);

  // Fetch user's card codes for cross-linking
  const { data: userCards } = await supabase
    .from("collection_cards")
    .select("card_code, card_name")
    .eq("user_id", user.id);

  const userCardCodes = new Set(
    (userCards ?? []).map((c) => c.card_code.toUpperCase())
  );
  const userCardNames = new Set(
    (userCards ?? []).map((c) => c.card_name.toLowerCase())
  );

  // Mark which intel items mention user's cards
  const enrichedItems = (items ?? []).map((item) => {
    const mentionsUserCard = (item.card_names ?? []).some(
      (name: string) =>
        userCardCodes.has(name.toUpperCase()) ||
        userCardNames.has(name.toLowerCase())
    );
    return { ...item, mentionsUserCard };
  });

  return <IntelFeed items={enrichedItems} />;
}
