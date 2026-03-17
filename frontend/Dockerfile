FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

EXPOSE 5173

CMD ["sh", "-c", "if [ ! -d node_modules/.vite ]; then npm install --no-audit --no-fund; fi && npx vite --host"]
