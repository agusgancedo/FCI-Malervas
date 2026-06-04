# Usamos una versión liviana de Node.js
FROM node:18-alpine

# Creamos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero los archivos de dependencias
COPY package*.json ./

# Instalamos las librerías (Express, pg, cors)
RUN npm install

# Copiamos todo el resto del código (src, app.js, etc.)
COPY . .

# Exponemos el puerto que usa tu API
EXPOSE 3030

# Comando para encender el servidor
CMD ["node", "src/app.js"]