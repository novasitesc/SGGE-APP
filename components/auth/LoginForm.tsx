"use client";

import { useActionState, useState } from "react";
import { loginAction, type AuthActionResult } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

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
      {/* Full-bleed atmospheric field */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="login-sky absolute inset-0" />
        <div className="login-sun absolute -right-[8%] top-[6%] size-[38vmin] rounded-full opacity-75 lg:left-[22%] lg:right-auto lg:top-[10%] lg:size-[24vmin]" />
        <div className="login-haze absolute inset-x-0 top-[28%] h-[40%] lg:top-[35%]" />
        <PastureSilhouette className="login-hills absolute inset-x-0 bottom-0 h-[52%] w-full lg:h-[58%]" />
        <div className="login-mist absolute inset-x-0 bottom-0 h-1/3" />
        <div className="login-grain absolute inset-0 opacity-[0.28]" />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
        {/* Brand plane */}
        <section className="flex flex-col justify-between px-6 pb-8 pt-10 sm:px-10 lg:px-14 lg:pb-12 lg:pt-14">
          <p className="login-fade-in text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#d4e0d4]/90]">
            Engorda · Costa Rica
          </p>

          <div className="mt-16 max-w-xl lg:mt-0">
            <h1 className="login-fade-in login-delay-1 font-[family-name:var(--font-login-display)] text-[clamp(3.5rem,12vw,7.5rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-[#f3f7f1]">
              SGGE
            </h1>
            <p className="login-fade-in login-delay-2 mt-5 max-w-md text-base leading-relaxed text-[#c5d4c5] sm:text-lg">
              Sistema de Gestión Ganadera. Operá corrales, costos y salud desde
              un solo lugar.
            </p>
          </div>

          <p className="login-fade-in login-delay-3 mt-10 hidden text-sm text-[#9fb09f] lg:block">
            Inventario · Alimentación · Salud · Reportes
          </p>
        </section>

        {/* Interaction panel */}
        <main className="flex items-end px-4 pb-6 sm:px-8 sm:pb-10 lg:items-center lg:px-12 lg:pb-0">
          <form
            action={formAction}
            className="login-panel login-fade-in login-delay-2 w-full max-w-md rounded-2xl border border-white/15 bg-[#0f1f16]/72] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8"
          >
            <input type="hidden" name="next" value={next} />

            <div className="mb-7 space-y-1.5">
              <h2 className="font-[family-name:var(--font-login-display)] text-2xl font-semibold tracking-tight text-[#f3f7f1]">
                Iniciar sesión
              </h2>
              <p className="text-sm text-[#a8bba8]">
                Accedé con tu correo de la granja.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium uppercase tracking-[0.14em] text-[#d7e6d7]"
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
                    "h-11 w-full rounded-xl border border-white/20 bg-white/8 px-3.5 text-sm text-[#f3f7f1]",
                    "placeholder:text-[#9aaf9a] outline-none transition",
                    "focus:border-[#a3d07a]/80 focus:bg-white/10 focus:ring-2 focus:ring-[#a3d07a]/30"
                  )}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium uppercase tracking-[0.14em] text-[#d7e6d7]"
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
                      "h-11 w-full rounded-xl border border-white/20 bg-white/8 px-3.5 pr-14 text-sm text-[#f3f7f1]",
                      "placeholder:text-[#9aaf9a] outline-none transition",
                      "focus:border-[#a3d07a]/80 focus:bg-white/10 focus:ring-2 focus:ring-[#a3d07a]/30"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-[#c5d8c5] transition hover:text-white"
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
                  "bg-[#c8e08a] text-sm font-semibold tracking-wide text-[#132016]",
                  "transition duration-300 hover:bg-[#d6eba0] active:translate-y-px",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8e08a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1f16]"
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

function PastureSilhouette({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 520"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 220C120 190 210 150 320 170C460 198 520 280 680 250C820 224 900 140 1040 150C1180 160 1280 230 1440 200V520H0V220Z"
        fill="#163222"
      />
      <path
        d="M0 300C160 270 260 230 400 250C560 276 640 340 790 310C930 282 1010 220 1160 240C1280 256 1360 300 1440 290V520H0V300Z"
        fill="#102819"
      />
      <path
        d="M0 380C180 350 300 330 460 355C640 385 720 430 900 400C1060 374 1180 350 1440 370V520H0V380Z"
        fill="#0c1f14"
      />
      {/* Cattle silhouettes — left pasture */}
      <g fill="#06100a" opacity="0.95">
        <path d="M210 390c8-28 28-46 52-46 26 0 44 18 52 46h-18c-4-14-14-24-34-24s-30 10-34 24h-18z" />
        <ellipse cx="262" cy="392" rx="48" ry="16" />
        <rect x="228" y="392" width="5" height="28" rx="2" />
        <rect x="246" y="392" width="5" height="30" rx="2" />
        <rect x="274" y="392" width="5" height="30" rx="2" />
        <rect x="292" y="392" width="5" height="26" rx="2" />
        <path d="M360 402c6-22 22-36 40-36 20 0 34 14 40 36h-14c-3-11-11-19-26-19s-23 8-26 19h-14z" />
        <ellipse cx="400" cy="404" rx="38" ry="13" />
        <rect x="374" y="404" width="4" height="22" rx="2" />
        <rect x="388" y="404" width="4" height="24" rx="2" />
        <rect x="410" y="404" width="4" height="24" rx="2" />
        <rect x="424" y="404" width="4" height="20" rx="2" />
      </g>
      <g stroke="#1f452c" strokeWidth="2.5" opacity="0.7">
        <line x1="80" y1="430" x2="80" y2="500" />
        <line x1="150" y1="438" x2="150" y2="505" />
        <line x1="220" y1="434" x2="220" y2="502" />
        <line x1="80" y1="452" x2="220" y2="456" />
        <line x1="80" y1="472" x2="220" y2="476" />
      </g>
    </svg>
  );
}
