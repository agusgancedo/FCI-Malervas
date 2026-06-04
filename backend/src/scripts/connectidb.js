const { Pool } = require("pg");

const dbClient = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

async function getSocios() {
    const response = await dbClient.query("SELECT * FROM socios");
    return response.rows;
}

async function getEstadoGlobal() {
    // 1. Obtenemos el valor total
    const mercadoRes = await dbClient.query("SELECT valor_total FROM mercado WHERE id = 1");
    const valorTotal = parseFloat(mercadoRes.rows[0].valor_total);

    // 2. Obtenemos el total de cuotapartes sumando las transacciones
    const cuotasRes = await dbClient.query("SELECT COALESCE(SUM(cuotapartes), 0) as total FROM transacciones");
    const totalCuotas = parseFloat(cuotasRes.rows[0].total);

    // Evitamos dividir por cero o números ínfimamente pequeños por decimales
    const precioCuota = totalCuotas > 0.0001 ? valorTotal / totalCuotas : 1000.0;

    // 3. Calculamos balances (Agregamos s.id para poder validar después)
    const balancesRes = await dbClient.query(`
        SELECT s.id, s.nombre,
               SUM(t.monto_fiat) as inversion_nominal,
               SUM(t.cuotapartes) as cuotas_poseidas
        FROM transacciones t
                 JOIN socios s ON t.id_socio = s.id
        GROUP BY s.id, s.nombre
        HAVING SUM(t.cuotapartes) > 0.0001
    `);

    return {
        valor_total: valorTotal,
        total_cuotas: totalCuotas,
        precio_cuota: precioCuota,
        socios: balancesRes.rows
    };
}

async function registrarTransaccion(id_socio, tipo, monto) {
    try {
        await dbClient.query('BEGIN'); // Iniciamos transacción segura SQL

        // Calculamos precio actual
        const estado = await getEstadoGlobal();
        let precioCuota = estado.precio_cuota;

        let montoDb = tipo === "RETIRO" ? -monto : monto;
        let cuotasDb = montoDb / precioCuota;

        // --- NUEVAS VALIDACIONES ANTI-BUGS ---
        if (tipo === "RETIRO") {
            // 1. Ver si la plata alcanza en la cuenta total del fondo
            if (monto > estado.valor_total) {
                throw new Error("El fondo no tiene suficiente dinero para este retiro.");
            }

            // 2. Ver si este socio en particular tiene suficientes cuotapartes
            const socio = estado.socios.find(s => s.id == id_socio);
            const cuotasPoseidas = socio ? parseFloat(socio.cuotas_poseidas) : 0;

            if (Math.abs(cuotasDb) > cuotasPoseidas + 0.0001) {
                const maxRetiro = (cuotasPoseidas * precioCuota).toFixed(2);
                throw new Error(`Fondos insuficientes. Este socio solo puede retirar hasta $${maxRetiro}.`);
            }
        }

        // Insertar Log
        await dbClient.query(
            "INSERT INTO transacciones (id_socio, tipo, monto_fiat, cuotapartes, precio_cuota) VALUES ($1, $2, $3, $4, $5)",
            [id_socio, tipo, montoDb, cuotasDb, precioCuota]
        );

        // Actualizar liquidez
        await dbClient.query(
            "UPDATE mercado SET valor_total = valor_total + $1 WHERE id = 1",
            [montoDb]
        );

        await dbClient.query('COMMIT');
        // Devolvemos un objeto con el éxito para que el frontend lo lea
        return { status: true, mensaje: "Transacción guardada con éxito" };
    } catch (e) {
        await dbClient.query('ROLLBACK');
        return { status: false, mensaje: e.message || "Error interno al registrar." };
    }
}

async function actualizarValorMercado(nuevoValor) {
    try {
        if(nuevoValor < 0) throw new Error("El valor del mercado no puede ser negativo");
        await dbClient.query("UPDATE mercado SET valor_total = $1 WHERE id = 1", [nuevoValor]);
        return { status: true, mensaje: "Mercado actualizado" };
    } catch (e) {
        return { status: false, mensaje: e.message };
    }
}

async function getHistorialTransacciones() {
    const response = await dbClient.query(`
        SELECT t.id, s.nombre, t.tipo, t.monto_fiat, t.cuotapartes, t.precio_cuota, t.fecha 
        FROM transacciones t
        JOIN socios s ON t.id_socio = s.id
        ORDER BY t.fecha DESC
    `);
    return response.rows;
}

async function limpiarHistorial() {
    try {
        await dbClient.query('BEGIN');
        // Vaciamos las transacciones y reseteamos el ID autoincremental
        await dbClient.query('TRUNCATE transacciones RESTART IDENTITY');
        // Volvemos el patrimonio del fondo a 0
        await dbClient.query('UPDATE mercado SET valor_total = 0 WHERE id = 1');
        await dbClient.query('COMMIT');
        return { status: true, mensaje: "Historial y saldos reiniciados a cero." };
    } catch (e) {
        await dbClient.query('ROLLBACK');
        return { status: false, mensaje: e.message || "Error al limpiar el historial." };
    }
}

module.exports = {
    getSocios,
    getEstadoGlobal,
    registrarTransaccion,
    actualizarValorMercado,
    getHistorialTransacciones,
    limpiarHistorial
};