import { Watchlist } from "@/components/watchlist";
import { Recommendations } from "@/components/recommendations";

export default function WatchPage() {
  return (
    <div>
      <Watchlist defaultOpen />
      <Recommendations defaultOpen />
    </div>
  );
}
