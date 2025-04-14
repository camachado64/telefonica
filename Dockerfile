FROM node:18.20.5
EXPOSE 3978
EXPOSE 443
WORKDIR /app
COPY package.json /app
COPY tsconfig.json /app
COPY ./src /app/src
#COPY ./env /app/env
RUN mkdir /certs
COPY telefonica-is-ticketbot.apps.ocp-epg.hi.inet.key /certs
COPY telefonica-is-ticketbot.apps.ocp-epg.hi.inet.cer /certs
#RUN ls -lh /app
#RUN ls -alR /app/* 
RUN npm install
RUN npm run build
#RUN ls -alR /app/*
CMD ["npm","run","start"]