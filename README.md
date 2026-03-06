# 💈 Salón Fresh Cuts — Sistema Completo

Agendamiento online, catálogo de productos y dashboard TV para el local.

---

## 🚀 Setup en 5 pasos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Supabase
1. Crea cuenta en [supabase.com](https://supabase.com) → Nuevo proyecto
2. Ve a **SQL Editor** → pega el contenido de `supabase-schema.sql` → **Run**
3. En **Realtime** → habilita las tablas: `appointments`, `barbers`, `products`
4. Copia tu `URL` y `anon key` y `service_role key`

### 3. Configurar Cloudinary
1. Cuenta en [cloudinary.com](https://cloudinary.com)
2. Settings → Upload → **Add upload preset** → Unsigned → nombre: `freshcuts_unsigned`
3. Copia tu `cloud name`

### 4. Completar `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=freshcuts_unsigned
```

### 5. Configurar contraseñas de barberos
Después de correr el SQL, ve a Supabase → Table Editor → `settings` y agrega:
- `pwd_<id_de_charles>` → contraseña del dueño
- `pwd_<id_barbero2>` → contraseña del barbero 2
- etc.

Si no configuras contraseña, la contraseña por defecto es: `freshcuts2026`

### 6. Correr el proyecto
```bash
npm run dev
```

---

## 📱 URLs del sistema

| URL | Para qué |
|-----|----------|
| `/` | Sitio público — clientes agendan y compran |
| `/admin` | Panel admin — Charles y los barberos |
| `/dashboard` | Dashboard TV — pantalla del local |

---

## 👥 Roles

### 👑 Charles (dueño)
- Ve TODAS las citas de todos los barberos
- Administra productos y categorías
- Edita servicios y precios
- Configura datos del negocio
- Gestiona al equipo (nombres, contraseñas, estados)

### ✂️ Barberos
- Solo ven SUS propias citas del día
- Pueden confirmar / atender / completar sus citas
- Cambian su propio estado (disponible / ocupado / descanso)

---

## 📺 Dashboard TV
Abre `/dashboard` en el navegador del TV y ponlo en pantalla completa (F11).
Se actualiza automáticamente en tiempo real con Supabase Realtime.
Los slides rotan cada 8 segundos: Agenda → Equipo → Productos.

---

## 🌐 Deploy en Vercel
1. Sube el proyecto a GitHub
2. Importa en [vercel.com](https://vercel.com)
3. Agrega las variables de `.env.local` en Vercel → Settings → Environment Variables
4. Deploy ✓

---

## 🎨 Paleta de colores
| Color | Hex |
|-------|-----|
| Negro | `#0a0a0a` |
| Dorado | `#C9A84C` |
| Dorado claro | `#E8C97A` |
| Crema | `#F5F0E8` |
