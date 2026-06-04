CREATE TABLE socios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    usuario VARCHAR(30) UNIQUE NOT NULL
);

-- Tabla de una sola fila para guardar la liquidez total actual
CREATE TABLE mercado (
    id INT PRIMARY KEY CHECK (id = 1),
    valor_total NUMERIC(15, 2) DEFAULT 0
);
INSERT INTO mercado (id, valor_total) VALUES (1, 0.0);

CREATE TABLE transacciones (
    id SERIAL PRIMARY KEY,
    id_socio INT REFERENCES socios(id),
    tipo VARCHAR(20) NOT NULL, -- 'APORTE' o 'RETIRO'
    monto_fiat NUMERIC(15, 2) NOT NULL,
    cuotapartes NUMERIC(15, 4) NOT NULL,
    precio_cuota NUMERIC(15, 4) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertamos a los nuevos socios del fondo
INSERT INTO socios (nombre, usuario) VALUES
    ('Agus', 'agus'),
    ('Tobi', 'tobi'),
    ('Nica', 'nica'),
    ('Octi', 'octi'),
    ('Gaby', 'gaby'),
    ('Fran', 'fran');