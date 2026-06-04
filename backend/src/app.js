require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const port = 3030;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend')));

const { getSocios, getEstadoGlobal, registrarTransaccion, actualizarValorMercado, getHistorialTransacciones, limpiarHistorial } = require("./scripts/connectidb.js");

// Endpoint: Obtener todos los balances y métricas (Para el Dashboard)
app.get("/api/estado", async (req, res) => {
    const estado = await getEstadoGlobal();
    res.status(200).json(estado);
});

// Endpoint: Obtener lista de socios (Para el select del formulario)
app.get("/api/socios", async (req, res) => {
    const socios = await getSocios();
    res.status(200).json(socios);
});

// Endpoint: Crear Aporte o Retiro
app.post("/api/transacciones", async (req, res) => {
    const { id_socio, tipo, monto } = req.body;

    if (!id_socio || !tipo || !monto || monto <= 0) {
        return res.status(400).json({ status: false, mensaje: "Datos inválidos" });
    }

    const resultado = await registrarTransaccion(id_socio, tipo, monto);

    // Si la DB rebotó la transacción (ej: falta de fondos), mandamos HTTP 400 y el mensaje de error
    if (!resultado.status) {
        return res.status(400).json(resultado);
    }

    res.status(201).json(resultado);
});

// Endpoint: Actualizar si las inversiones rinden ganancias/pérdidas
app.put("/api/mercado", async (req, res) => {
    const { nuevo_valor } = req.body;

    const resultado = await actualizarValorMercado(nuevo_valor);
    if (!resultado.status) {
        return res.status(400).json(resultado);
    }

    res.status(200).json(resultado);
});

// Endpoint: Obtener historial de transacciones
app.get("/api/transacciones", async (req, res) => {
    try {
        const historial = await getHistorialTransacciones();
        res.status(200).json(historial);
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: false, mensaje: "Error al obtener historial" });
    }
});

// Endpoint: Borrar todo el historial (Reset de temporada)
app.delete("/api/transacciones", async (req, res) => {
    const resultado = await limpiarHistorial();
    if (!resultado.status) {
        return res.status(500).json(resultado);
    }
    res.status(200).json(resultado);
});

app.listen(port, () => {
    console.log("Listening on port", port);
});