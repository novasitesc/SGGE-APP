import { Fraunces, Outfit } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-login-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-login-sans",
  display: "swap",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${outfit.variable} min-h-full bg-[#120c08]`}
    >
      {children}
    </div>
  );
}
