import Link from "next/link";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {/* Logo */}
        <div className="mb-6">
          <img src="/logo.svg" alt="MyTCG" className="h-10 mx-auto" style={{ filter: "brightness(0) saturate(100%) invert(14%) sepia(95%) saturate(5765%) hue-rotate(355deg) brightness(87%) contrast(96%)" }} />
        </div>

        {/* Invite card */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-6 mb-6">
          <div className="text-lg font-semibold text-text mb-2">You&apos;ve been invited!</div>
          <p className="text-sm text-text-muted mb-6">
            A friend wants to connect with you on MyTCG — the One Piece TCG collection tracker.
            Sign up to track your cards, check prices, scan at events, and see what your friends are collecting.
          </p>

          <div className="space-y-3">
            <Link
              href={`/sign-up?redirect_url=/friends&invite=${id}`}
              className="block w-full bg-text text-bg font-medium text-sm py-3 rounded-xl hover:opacity-90 active:opacity-80 transition-opacity text-center"
            >
              Sign up free
            </Link>
            <Link
              href={`/sign-in?redirect_url=/friends&invite=${id}`}
              className="block w-full text-sm font-medium text-text-muted hover:text-text py-2 text-center transition-colors"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3 text-left">
          {[
            { icon: "📱", title: "Scan cards instantly", desc: "Point your camera at any One Piece card" },
            { icon: "📊", title: "Track your portfolio", desc: "See your collection value in real-time" },
            { icon: "🤝", title: "Connect with friends", desc: "Share collections and see activity" },
            { icon: "💰", title: "Find the best prices", desc: "Compare across eBay, Cardmarket, TCGplayer" },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3 bg-white rounded-xl border border-[rgba(0,0,0,0.04)] px-4 py-3">
              <span className="text-lg flex-none">{f.icon}</span>
              <div>
                <div className="text-sm font-medium text-text">{f.title}</div>
                <div className="text-xs text-text-dim">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-text-dim">
          Powered by MyTCG
        </div>
      </div>
    </div>
  );
}
