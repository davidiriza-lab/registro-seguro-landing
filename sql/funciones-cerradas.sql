-- Cerrar las funciones de Postgres al rol anónimo.
-- Revocar de PUBLIC es lo que cuenta: anon y authenticated heredan de ahí.
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

-- Que las funciones futuras nazcan cerradas
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant  execute on functions to service_role;
