FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# --ignore-scripts: ບໍ່ຮັນ installed script ຂອງ node-windows (Windows-only) ໃນ Linux
# --omit=dev: ບໍ່ເອົາ devDependencies ເຂົ້າ image ເພື່ອຂະໜາດນ້ອຍລົງ
RUN npm install --omit=dev --ignore-scripts
COPY . .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 5001
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]