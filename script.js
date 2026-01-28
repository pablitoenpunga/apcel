let productos = JSON.parse(localStorage.getItem('gya_pro_items')) || [];
let ventas = JSON.parse(localStorage.getItem('gya_pro_sales')) || [];

function render() {
    const tbodyP = document.querySelector('#tabla-productos tbody');
    tbodyP.innerHTML = '';
    productos.forEach(p => {
        const esBajo = p.stock <= (p.minimo || 10);
        const ganancia = (((p.venta - p.costo) / p.costo) * 100).toFixed(0);
        
        tbodyP.innerHTML += `
            <tr class="${esBajo ? 'low-stock-row' : ''}">
                <td>${p.nombre} ${esBajo ? '⚠️' : ''}</td>
                <td>${p.stock}</td>
                <td>$${p.venta}</td>
                <td class="badge-ganancia">${ganancia}%</td>
                <td><button onclick="borrarP(${p.id})" class="btn-del">X</button></td>
            </tr>`;
    });

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
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const totalDia = ventas
        .filter(v => v.fechaStr === hoyStr)
        .reduce((s, v) => s + v.total, 0);

    const totalMes = ventas
        .filter(v => v.mes === mesActual && v.anio === anioActual)
        .reduce((s, v) => s + v.total, 0);

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
        const t = new Date();
        p.stock -= c;
        ventas.push({
            idProd: p.id,
            fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(),
            anio: t.getFullYear(),
            hora: t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            nombre: p.nombre,
            cantidad: c,
            total: p.venta * c,
            pago: document.getElementById('v-pago').value
        });
        save(); e.target.reset(); actualizarTotalVenta();
    } else { alert("Stock insuficiente"); }
});

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const caja = actualizarDashboard();
    doc.setFontSize(20); doc.setTextColor(30, 55, 153);
    doc.text("GestionYa PRO - Informe de Caja", 14, 20);
    doc.setFontSize(11); doc.setTextColor(40);
    doc.text(`Total Diario: $${caja.totalDia} | Total Mensual: $${caja.totalMes}`, 14, 30);
    doc.autoTable({
        startY: 35,
        head: [['Hora', 'Producto', 'Cant', 'Pago', 'Total']],
        body: ventas.map(v => [v.hora, v.nombre, v.cantidad, v.pago, `$${v.total}`])
    });
    doc.save(`GestionYa_Reporte_${new Date().toLocaleDateString()}.pdf`);
}

function save() { 
    localStorage.setItem('gya_pro_items', JSON.stringify(productos)); 
    localStorage.setItem('gya_pro_sales', JSON.stringify(ventas)); 
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

function limpiarTodo() { if(confirm("¿Resetear GestionYa?")) { localStorage.clear(); location.reload(); } }

render();