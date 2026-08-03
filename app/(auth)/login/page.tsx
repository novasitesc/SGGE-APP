import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = {
  title: "Iniciar sesión — SGGE",
};

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return <LoginForm next={next ?? "/dashboard"} />;
}
