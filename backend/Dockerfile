FROM node:20-alpine

WORKDIR /app

# Lockfile'a göre bağımlılıklar container İÇİNDE (Linux) kurulur — Windows
# node_modules asla image'a kopyalanmaz (bkz. .dockerignore).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Backend'in gerçek, mevcut portu (bkz. .env PORT=3001) — burada
# UYDURULMADI, koddan (src/config/env.ts) doğrulanan değerdir.
EXPOSE 3001

# Mevcut çalışma komutu (package.json "dev": "tsx watch src/server.ts") —
# iş mantığı/derleme adımı DEĞİŞTİRİLMEDİ, aynı script container içinde
# çalıştırılıyor.
CMD ["npm", "run", "dev"]
