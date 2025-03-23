FROM node:18.20.5
EXPOSE 3978
WORKDIR /app
COPY package.json /app
COPY tsconfig.json /app
COPY ./src /app/src
#RUN ls -lh /app
#RUN ls -alR /app/* 
RUN npm install
RUN npm run build
#RUN ls -alR /app/*
CMD ["npm","run","start"]