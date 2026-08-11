-- Migration: rotar la credencial sembrada en 20250614000000_mensajeria_aprobacion.sql
--
-- Esa migración generaba `password_hash` a partir de una contraseña en claro
-- versionada en el repositorio, por lo que cualquiera con acceso al historial de
-- git podía autenticarse contra el RPC legacy `verificar_aprobador`.
--
-- El login de la aplicación usa Supabase Auth, y `verificar_aprobador` ya no
-- tiene ningún consumidor en `app/api/**`, así que invalidar el hash no quita
-- acceso a nadie. El acceso se concede creando el usuario en Supabase Auth y
-- enlazándolo con `usuarios.auth_user_id`.
--
-- Rollback: no aplicable. La contraseña anterior está comprometida y no debe
-- restaurarse. Si hiciera falta reactivar el camino legacy, asigne un hash nuevo
-- fuera del control de versiones.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

UPDATE usuarios
SET password_hash = crypt(gen_random_uuid()::text, gen_salt('bf', 12))
WHERE id = '44444444-4444-4444-4444-444444444444';
