# Railway Deployment Guide

## Archivos Docker Creados

- ✅ `Dockerfile` - Configuración multi-stage optimizada para Next.js 15
- ✅ `.dockerignore` - Archivos excluidos del build
- ✅ `railway.json` - Configuración específica de Railway
- ✅ `docker-compose.yml` - Para testing local (opcional)

## Pasos para Deployar en Railway

### Opción 1: Deploy desde GitHub (Recomendado)

1. **Commit y push los cambios:**
   ```bash
   git add .
   git commit -m "Add Docker configuration for Railway deployment"
   git push origin main
   ```

2. **En Railway Dashboard:**
   - Ve a https://railway.app/dashboard
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Elige tu repositorio `top_coach`
   - Railway detectará automáticamente el Dockerfile

3. **Configurar Variables de Entorno:**
   En Railway, añade estas variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ENCRYPTION_KEY`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_APP_DOMAIN` (usar el dominio que Railway te asigne)

### Opción 2: Deploy con Railway CLI

1. **Instalar Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Inicializar proyecto:**
   ```bash
   railway init
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Configurar variables de entorno:**
   ```bash
   railway variables
   ```

## Variables de Entorno Requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=https://ydqhndnvrkvycnkaghro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
ENCRYPTION_KEY=tu_encryption_key_aqui
JWT_SECRET=tu_jwt_secret_aqui
NEXT_PUBLIC_APP_DOMAIN=tu-app.railway.app
```

## Configuración de Dominio

Una vez deployado, Railway te dará un dominio como `tu-app.railway.app`

**Actualiza `NEXT_PUBLIC_APP_DOMAIN`** con este dominio para que el middleware funcione correctamente.

## Multi-tenant con Subdomains

Railway soporta wildcards para subdomains. Para configurar:

1. En Railway Dashboard → Settings → Domains
2. Agrega un custom domain
3. Configura DNS con wildcard: `*.tudominio.com`

## Monitoreo

- **Logs:** `railway logs`
- **Status:** Railway Dashboard muestra métricas en tiempo real
- **Rollback:** Cada deploy crea un snapshot, puedes rollback desde el dashboard

## Troubleshooting

Si el build falla:
1. Revisa los logs en Railway Dashboard
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate que el repo esté actualizado en GitHub

## Notas Importantes

- ✅ Railway detecta automáticamente el Dockerfile
- ✅ El build usa cache, deploys subsecuentes son más rápidos
- ✅ Railway auto-reinicia el servicio si falla
- ✅ Soporta HTTPS automáticamente
- ✅ Escalado automático disponible en planes pagos

