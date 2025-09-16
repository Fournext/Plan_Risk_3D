# Imagen base con Python 3.6.13
FROM python:3.6.13-slim

# Evitar que Python genere archivos .pyc
ENV PYTHONDONTWRITEBYTECODE 1

# Evitar que Python use buffer (mejor para logs en contenedores)
ENV PYTHONUNBUFFERED 1

# Directorio de trabajo en el contenedor
WORKDIR /app

# Instalar dependencias del sistema (ej. psycopg2 necesita gcc, libpq-dev)
RUN sed -i 's|deb.debian.org|archive.debian.org|g' /etc/apt/sources.list \
    && sed -i 's|security.debian.org|archive.debian.org|g' /etc/apt/sources.list \
    && sed -i '/deb.*buster-updates/d' /etc/apt/sources.list \
    && apt-get update && apt-get install -y \
       gcc \
       libpq-dev \
       git \
    && rm -rf /var/lib/apt/lists/*
# Copiar el requirements.txt primero (para aprovechar el cache de Docker)
COPY requirements.txt /app/

# Instalar dependencias de Python
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiar todo el código del proyecto
COPY . /app/

# Exponer el puerto (ej. 8000 para Django)
EXPOSE 8000
