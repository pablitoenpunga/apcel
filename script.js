let productos = JSON.parse(localStorage.getItem('fmp_data_v4')) || [];
let ventas = JSON.parse(localStorage.getItem('fmp_sales_v4')) || [];

function render() {
    // 1. Tabla de Productos con cálculo de ganancia
    const tbodyP = document.querySelector('#tabla-productos tbody');
    tbodyP.innerHTML = '';
    productos.forEach(p => {
        const esBajo = p.stock <= (p.minimo || 10);
        // Cálculo de % de Ganancia
        const porcentajeGanancia = (((p.venta - p.costo) / p.costo) * 100).toFixed(0);
        
        tbodyP.innerHTML += `
            <tr class="${esBajo ? 'low-stock-row' : ''}">
                <td>${p.nombre} ${esBajo ? '⚠️' : ''}</td>
                <td>${p.stock}</td>
                <td>$${p.venta}</td>
                <td class="badge-ganancia">${porcentajeGanancia}%</td>
                <td><button onclick="borrarP(${p.id})" class="btn-del">X</button></td>
            </tr>`;
    });

    // 2. Tabla de Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    tbodyV.innerHTML = '';
    [...ventas].reverse().slice(0, 10).forEach((v, i) => {
        tbodyV.innerHTML += `
            <tr>
                <td>${v.hora}</td>
                <td>${v.nombre}</td>
                <td>$${v.total}</td>
                <td><button onclick="anularV(${ventas.length - 1 - i})" class="btn-del">↩</button></td>
            </tr>`;
    });

    actualizarSelectores();
    actualizarDashboard();
}

function actualizarDashboard() {
    const hoyStr = new Date().toLocaleDateString();
    const mesActual = new Date().getMonth();
    const totalDia = ventas.filter(v => v.fecha === hoyStr).reduce((s, v) => s + v.total, 0);
    const totalMes = ventas.filter(v => {
        const [, m] = v.fecha.split('/');
        return (parseInt(m) - 1) === mesActual;
    }).reduce((s, v) => s + v.total, 0);

    document.getElementById('stat-dia').innerText = `$${totalDia.toLocaleString()}`;
    document.getElementById('stat-mes').innerText = `$${totalMes.toLocaleString()}`;
    return { totalDia, totalMes };
}

function actualizarTotalVenta() {
    const p = productos.find(x => x.id == document.getElementById('v-producto').value);
    const c = document.getElementById('v-cantidad').value;
    document.getElementById('display-total').innerText = (p && c > 0) ? `Total: $${(p.venta * c).toLocaleString()}` : "Total: $0.00";
}

document.getElementById('venta-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = productos.find(x => x.id == document.getElementById('v-producto').value);
    const c = parseInt(document.getElementById('v-cantidad').value);

    if (p && p.stock >= c) {
        p.stock -= c;
        ventas.push({
            idProd: p.id, fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            nombre: p.nombre, cantidad: c, total: p.venta * c, pago: document.getElementById('v-pago').value
        });
        save(); e.target.reset(); actualizarTotalVenta();
    } else { alert("Stock insuficiente."); }
});

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const caja = actualizarDashboard();
    doc.setFontSize(18); doc.text("Reporte de Caja - FactuManager Pro", 14, 20);
    doc.setFontSize(11); doc.text(`Ventas Hoy: $${caja.totalDia} | Ventas Mes: $${caja.totalMes}`, 14, 30);
    doc.autoTable({
        startY: 35,
        head: [['Hora', 'Producto', 'Cant', 'Total']],
        body: ventas.map(v => [v.hora, v.nombre, v.cantidad, `$${v.total}`])
    });
    doc.save(`Reporte_${new Date().toLocaleDateString()}.pdf`);
}

function save() { 
    localStorage.setItem('fmp_data_v4', JSON.stringify(productos)); 
    localStorage.setItem('fmp_sales_v4', JSON.stringify(ventas)); 
    render(); 
}

function showTab(id) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}

document.getElementById('prod-form').addEventListener('submit', (e) => {
    e.preventDefault();
    productos.push({
        id: Date.now(),
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value),
        minimo: parseInt(document.getElementById('p-minimo').value),
        costo: parseFloat(document.getElementById('p-costo').value),
        venta: parseFloat(document.getElementById('p-venta').value)
    });
    save(); e.target.reset();
});

function borrarP(id) { if(confirm("¿Eliminar?")) { productos = productos.filter(x => x.id !== id); save(); } }
function anularV(idx) {
    const v = ventas[idx]; const p = productos.find(x => x.id == v.idProd);
    if(p) p.stock += v.cantidad; ventas.splice(idx, 1); save();
}

function actualizarSelectores() {
    const s = document.getElementById('v-producto'); const val = s.value;
    s.innerHTML = '<option value="">Seleccione Producto...</option>';
    productos.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`);
    s.value = val;
}

function limpiarTodo() { if(confirm("¿Resetear sistema?")) { localStorage.clear(); location.reload(); } }

render();