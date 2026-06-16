export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 sm:px-6 pb-8 max-w-[1280px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
