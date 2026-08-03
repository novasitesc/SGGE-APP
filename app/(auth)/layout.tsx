export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-b from-stone-100 to-stone-200 px-4 py-12">
      {children}
    </div>
  );
}
