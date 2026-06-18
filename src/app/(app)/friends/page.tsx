"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

type Friend = { id: string; friendId: string; name: string; since: string };
type PendingRequest = { id: string; fromUserId: string; name: string; createdAt: string };
type Activity = {
  id: string; userId: string; userName: string; isOwn: boolean;
  action: string; cardCode: string | null; cardName: string | null;
  cardImageUrl: string | null; collectionName: string | null;
  metadata: Record<string, unknown> | null; createdAt: string;
};

export default function FriendsPage() {
  const { user } = useUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"activity" | "friends">("activity");

  useEffect(() => {
    fetch("/api/friends").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) { setFriends(d.friends); setPending(d.pendingReceived); }
    }).catch(() => {});

    fetch("/api/activity?limit=30").then((r) => r.ok ? r.json() : []).then(setActivity).catch(() => {});
  }, []);

  async function sendRequest() {
    if (!friendCode.trim()) return;
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: friendCode.trim() }),
    });
    if (res.ok) {
      setAddMsg("Request sent!");
      setFriendCode("");
    } else {
      const err = await res.json();
      setAddMsg(err.error ?? "Failed");
    }
    setTimeout(() => setAddMsg(null), 2000);
  }

  async function handleRequest(id: string, action: "accept" | "reject") {
    await fetch("/api/friends", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setPending((prev) => prev.filter((p) => p.id !== id));
    if (action === "accept") {
      // Refresh friends list
      fetch("/api/friends").then((r) => r.ok ? r.json() : null).then((d) => {
        if (d) setFriends(d.friends);
      });
    }
  }

  async function removeFriend(id: string) {
    if (!confirm("Remove this friend?")) return;
    await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setFriends((prev) => prev.filter((f) => f.id !== id));
  }

  function timeAgo(dateStr: string) {
    const mins = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  }

  function activityText(a: Activity) {
    switch (a.action) {
      case "added_card": return `added ${a.cardName ?? a.cardCode ?? "a card"}`;
      case "batch_scan": {
        const count = (a.metadata as { count?: number })?.count ?? 0;
        return `scanned ${count} cards`;
      }
      case "created_collection": return `created "${a.collectionName}"`;
      case "milestone": return (a.metadata as { message?: string })?.message ?? "hit a milestone";
      default: return a.action;
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-[rgba(0,0,0,0.06)]">
        <button onClick={() => setTab("activity")} className={`px-4 py-2.5 text-sm font-medium relative ${tab === "activity" ? "text-text" : "text-text-dim hover:text-text"}`}>
          Activity
          {tab === "activity" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
        </button>
        <button onClick={() => setTab("friends")} className={`px-4 py-2.5 text-sm font-medium relative ${tab === "friends" ? "text-text" : "text-text-dim hover:text-text"}`}>
          Friends{friends.length > 0 && ` (${friends.length})`}
          {tab === "friends" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text rounded-full" />}
        </button>
      </div>

      {/* ═══ ACTIVITY FEED ═══ */}
      {tab === "activity" && (
        <div>
          {activity.length === 0 ? (
            <div className="py-12 text-center text-text-dim text-sm">
              No activity yet. Add friends to see what they're collecting.
            </div>
          ) : (
            <div className="space-y-1">
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-3 border-b border-[rgba(0,0,0,0.04)]">
                  {a.cardImageUrl ? (
                    <div className="w-9 aspect-[63/88] rounded-lg overflow-hidden bg-[#E4E4E7] flex-none">
                      <img src={a.cardImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center flex-none">
                      <span className="text-xs font-semibold text-text-dim">{(a.userName ?? "U")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text">
                      <span className="font-semibold">{a.isOwn ? "You" : a.userName}</span>
                      {" "}{activityText(a)}
                    </div>
                    {a.collectionName && a.action === "added_card" && (
                      <div className="text-xs text-text-dim">to {a.collectionName}</div>
                    )}
                  </div>
                  <span className="text-xs text-text-dim flex-none">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ FRIENDS ═══ */}
      {tab === "friends" && (
        <div>
          {/* Add friend */}
          <div className="mb-6">
            <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Add friend by user ID</div>
            <div className="flex gap-2">
              <input
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="Paste their user ID..."
                className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-sm text-text outline-none focus:border-text/20"
              />
              <button onClick={sendRequest} className="bg-text text-bg font-medium text-sm py-2.5 px-4 rounded-xl active:opacity-80">
                Add
              </button>
            </div>
            {addMsg && <div className="text-sm text-[#059669] mt-1">{addMsg}</div>}
            {user && (
              <div className="mt-2 text-xs text-text-dim">
                Your ID: <span className="font-mono select-all">{user.id}</span>
              </div>
            )}
          </div>

          {/* Pending requests */}
          {pending.length > 0 && (
            <div className="mb-6">
              <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Pending requests</div>
              <div className="space-y-1.5">
                {pending.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center flex-none">
                      <span className="text-xs font-semibold text-text-dim">{p.name[0].toUpperCase()}</span>
                    </div>
                    <span className="flex-1 text-sm font-medium text-text">{p.name}</span>
                    <button onClick={() => handleRequest(p.id, "accept")} className="text-xs font-medium text-[#059669] active:opacity-70">Accept</button>
                    <button onClick={() => handleRequest(p.id, "reject")} className="text-xs text-text-dim active:opacity-70">Decline</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          {friends.length > 0 ? (
            <div>
              <div className="text-xs text-text-dim uppercase tracking-wider mb-2">Your friends</div>
              <div className="space-y-1.5">
                {friends.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center flex-none">
                      <span className="text-xs font-semibold text-text-dim">{f.name[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text">{f.name}</div>
                    </div>
                    <button onClick={() => removeFriend(f.id)} className="text-xs text-text-dim hover:text-red-400 active:opacity-70">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-text-dim text-sm">
              No friends yet. Share your user ID to connect.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
