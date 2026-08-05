"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { loginAction, type AuthActionResult } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const LOGIN_HERO =
  "/GanadoInventario/pexels-diego-f-parra-33199-15477960.jpg";

type Props = {
  next?: string;
};

export function LoginForm({ next = "/dashboard" }: Props) {
  const [state, formAction, pending] = useActionState<
    AuthActionResult | null,
    FormData
  >(loginAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="login-page relative min-h-dvh overflow-hidden font-[family-name:var(--font-login-sans)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src={LOGIN_HERO}
          alt=""
          fill
          priority
          sizes="100vw"
          className="login-hero-img object-cover object-[38%_40%] sm:object-[42%_38%]"
        />
        <div className="login-hero-shade absolute inset-0" />
        <div className="login-grain absolute inset-0 opacity-[0.18]" />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between px-6 pb-8 pt-10 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14">
          <p className="login-fade-in text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#f0ebe3]/85]">
            Engorda · Costa Rica
          </p>

          <div className="mt-16 max-w-xl lg:mt-0">
            <h1 className="login-fade-in login-delay-1 font-[family-name:var(--font-login-display)] text-[clamp(3.5rem,12vw,7.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-[#f7f3ec] drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
              SGGE
            </h1>
            <p className="login-fade-in login-delay-2 mt-5 max-w-md text-base leading-relaxed text-[#ebe4d8] sm:text-lg">
              Sistema de Gestión Ganadera. Operá corrales, costos y salud desde
              un solo lugar.
            </p>
          </div>

          <p className="login-fade-in login-delay-3 mt-10 hidden text-sm text-[#d8d0c4]/90] lg:block">
            Inventario · Alimentación · Salud · Reportes
          </p>
        </section>

        <main className="flex items-end px-4 pb-6 sm:px-8 sm:pb-10 lg:items-center lg:px-12 lg:pb-0">
          <form
            action={formAction}
            className="login-panel login-fade-in login-delay-2 w-full max-w-md rounded-2xl border border-white/20 bg-[#1a120e]/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8"
          >
            <input type="hidden" name="next" value={next} />

            <div className="mb-7 space-y-1.5">
              <h2 className="font-[family-name:var(--font-login-display)] text-2xl font-semibold tracking-tight text-[#f7f3ec]">
                Iniciar sesión
              </h2>
              <p className="text-sm text-[#d4c8b8]">
                Accedé con tu correo de la granja.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium uppercase tracking-[0.14em] text-[#ebe0d0]"
                >
                  Correo
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="usuario@granja.demo"
                  className={cn(
                    "h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-sm text-[#f7f3ec]",
                    "placeholder:text-[#b8a990] outline-none transition",
                    "focus:border-[#e2c08a]/80 focus:bg-white/14 focus:ring-2 focus:ring-[#e2c08a]/35"
                  )}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium uppercase tracking-[0.14em] text-[#ebe0d0]"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className={cn(
                      "h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 pr-14 text-sm text-[#f7f3ec]",
                      "placeholder:text-[#b8a990] outline-none transition",
                      "focus:border-[#e2c08a]/80 focus:bg-white/14 focus:ring-2 focus:ring-[#e2c08a]/35"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-[#ddd0bc] transition hover:text-white"
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              {state && "error" in state && (
                <p
                  className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                  role="alert"
                >
                  {state.error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className={cn(
                  "group relative mt-1 flex h-12 w-full items-center justify-center overflow-hidden rounded-xl",
                  "bg-[#e8c98a] text-sm font-semibold tracking-wide text-[#2a1c12]",
                  "transition duration-300 hover:bg-[#f0d6a0] active:translate-y-px",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a120e]"
                )}
              >
                <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/35 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
                <span className="relative">
                  {pending ? "Entrando…" : "Entrar"}
                </span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
