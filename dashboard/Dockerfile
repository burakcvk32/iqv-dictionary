FROM node:20-alpine

WORKDIR /app

# KOK NEDEN (2026-08-31 duzeltmesi): dashboard'un GERCEK paket yoneticisi
# pnpm'dir (pnpm-lock.yaml kaynak-dogrusu, package.json'daki
# "packageManager": "pnpm@9.15.9" alani corepack'e bunu bildirir) --
# onceki surum yanlislikla npm/package-lock.json kullaniyordu. Windows
# node_modules asla image'a kopyalanmaz (bkz. .dockerignore).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Frontend'in dışarıdan erişilen portu (5173) — mevcut vite.config.ts'te
# zaten host:0.0.0.0/port:5173 olarak ayarlı (LAN erişimi turu).
EXPOSE 5173

# Mevcut çalışma komutu (package.json "dev": "vite") — build/UI/iş mantığı
# DEĞİŞTİRİLMEDİ, aynı script container içinde çalıştırılıyor.
CMD ["pnpm", "run", "dev"]
