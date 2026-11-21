# Used by Hugging Face Spaces (free, no credit card) and any Docker host.
FROM node:22-slim
WORKDIR /app
COPY --chown=node:node . .
RUN chown node:node /app
USER node
RUN npm install --prefix client --include=dev && npm install --prefix server && npm run build
ENV PORT=7860 NODE_ENV=production
EXPOSE 7860
CMD ["npm", "start"]
