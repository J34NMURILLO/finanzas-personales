# Finanzas Personales

App de finanzas personales con carga de gastos por chat (web y, en una fase posterior, WhatsApp).

- Frontend: React + Vite + Tailwind
- Backend: funciones serverless de Node.js (carpeta `api/`), desplegadas junto al frontend en Vercel
- Base de datos: Postgres en Neon
- Parseo de mensajes: API de Claude (Anthropic), llamada directamente desde `api/chat`

## Desarrollo local

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL` y `ANTHROPIC_API_KEY`.
3. `npx vercel dev` (corre frontend + funciones `/api` juntos, igual que en producción).

## Variables de entorno

- `DATABASE_URL`: connection string de Neon.
- `ANTHROPIC_API_KEY`: API key de Anthropic, usada por `api/chat` para interpretar los mensajes de gastos.

## Estado

Fase 1 en curso: CRUD de categorías, cuentas, tarjetas, ingresos, gastos fijos y compras en cuotas, más el chat web de carga de gastos. WhatsApp (Meta Cloud API) se conecta en una fase posterior.
