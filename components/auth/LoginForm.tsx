"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionResult } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  next?: string;
};

export function LoginForm({ next = "/dashboard" }: Props) {
  const [state, formAction, pending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginAction, null);

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-2">
        <p className="text-3xl font-semibold tracking-tight text-stone-900">
          SGGE
        </p>
        <p className="text-sm text-stone-600">
          Sistema de Gestión Ganadera — inicie sesión para continuar
        </p>
      </div>

      <form
        action={formAction}
        className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-sm space-y-4"
      >
        <input type="hidden" name="next" value={next} />

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="usuario@granja.demo"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state && "error" in state && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
