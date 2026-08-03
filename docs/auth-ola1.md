# Auth Ola 1 — Supabase Auth + aislamiento de granja

## Variables de entorno

Ver [`.env.example`](../.env.example):

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente SSR/browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor, post-autorización |
| `AUTH_PROXY_ENFORCE=true` | Redirect a `/login` en rutas de app/gestión |

## Enlazar usuario de negocio

1. Crear usuario en Supabase Auth (Dashboard → Authentication → Users) con el mismo email que `public.usuarios.email`.
2. Aplicar migración `20260802140000_usuarios_auth_user_id.sql`.
3. Enlazar:

```sql
UPDATE public.usuarios
SET auth_user_id = '<uuid de auth.users>'
WHERE email = 'gerente@srrg.demo';
```

Sin `auth_user_id`, la API responde **403** aunque el login Auth sea válido.

## Comportamiento

- UI protegida: proxy redirige a `/login` si no hay sesión (`AUTH_PROXY_ENFORCE`).
- APIs: **401** sin cookie; **403** si `farmId`/`granjaId` ≠ `usuarios.granja_id`.
- Aprobaciones: sesión con rol `gerente` o `admin` (sin password en el body).
