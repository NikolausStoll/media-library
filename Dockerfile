FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN npm run build

ENV NODE_ENV=production
EXPOSE 8787

CMD ["npm", "run", "start:backend"]
