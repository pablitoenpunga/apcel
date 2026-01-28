let productos = JSON.parse(localStorage.getItem('factu_pro_items')) || [];
let ventas = JSON.parse(localStorage.getItem('factu_pro_sales')) || [];

// --- REFRESCAR VISTA ---
function render() {
    // 1. Inventario con aviso de stock bajo
    const tbodyP = document.querySelector('#tabla-productos tbody');
    tbodyP.innerHTML = '';
    productos.forEach(p => {
        const esCritico = p.stock <= (p.minimo || 10);
        tbodyP.innerHTML += `
            <tr class="${esCritico ? 'low-stock-row' : ''}">
                <td>${p.nombre} ${esCritico ? '⚠️' : ''}</td>
                <td>${p.stock}</td>
                <td>$${p.venta}</td>
                <td><button onclick="borrarP(${p.id})" class="btn-del">X</button></td>
            </tr>`;
    });

    // 2. Historial de Ventas
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

// --- LOGICA DE CAJA (Día y Mes) ---
function actualizarDashboard() {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString();
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();

    const totalDia = ventas
        .filter(v => v.fecha === hoyStr)
        .reduce((sum, v) => sum + v.total, 0);

    const totalMes = ventas
        .filter(v => {
            const [d, m, a] = v.fecha.split('/');
            return (parseInt(m) - 1) === mesActual && parseInt(a) === añoActual;
        })
        .reduce((sum, v) => sum + v.total, 0);

    document.getElementById('stat-dia').innerText = `$${totalDia.toLocaleString()}`;
    document.getElementById('stat-mes').innerText = `$${totalMes.toLocaleString()}`;
    
    return { totalDia, totalMes };
}

// --- VENTAS ---
function actualizarTotalVenta() {
    const id = document.getElementById('v-producto').value;
    const cant = document.getElementById('v-cantidad').value;
    const prod = productos.find(x => x.id == id);
    const label = document.getElementById('display-total');
    label.innerText = (prod && cant > 0) ? `Total: $${(prod.venta * cant).toLocaleString()}` : "Total: $0.00";
}

document.getElementById('venta-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const prod = productos.find(x => x.id == document.getElementById('v-producto').value);
    const cant = parseInt(document.getElementById('v-cantidad').value);

    if (prod && prod.stock >= cant) {
        prod.stock -= cant;
        ventas.push({
            idProd: prod.id,
            fecha: new Date().toLocaleDateString(),
            hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            nombre: prod.nombre,
            cantidad: cant,
            total: prod.venta * cant,
            pago: document.getElementById('v-pago').value
        });
        save();
        e.target.reset();
        actualizarTotalVenta();
    } else {
        alert("¡Error! Stock insuficiente para realizar la venta.");
    }
});

// --- PDF CON MATEMÁTICAS DEL DÍA/MES ---
function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const caja = actualizarDashboard();

    doc.setFontSize(22);
    doc.setTextColor(30, 55, 153);
    doc.text("FactuManager Pro - Reporte", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28);

    // Resumen Superior
    doc.setFillColor(241, 242, 246);
    doc.rect(14, 35, 182, 25, 'F');
    doc.setTextColor(47, 53, 66);
    doc.setFontSize(12);
    doc.text(`TOTAL DEL DÍA: $${caja.totalDia.toLocaleString()}`, 20, 45);
    doc.text(`TOTAL DEL MES: $${caja.totalMes.toLocaleString()}`, 20, 53);

    doc.autoTable({
        startY: 70,
        head: [['Hora', 'Producto', 'Cant', 'Pago', 'Subtotal']],
        body: ventas.map(v => [v.hora, v.nombre, v.cantidad, v.pago, `$${v.total}`]),
        theme: 'striped',
        headStyles: { fillColor: [30, 55, 153] }
    });

    doc.save(`Reporte_FactuManager_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
}

// --- AUXILIARES ---
function save() {
    localStorage.setItem('factu_pro_items', JSON.stringify(productos));
    localStorage.setItem('factu_pro_sales', JSON.stringify(ventas));
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

function borrarP(id) { if(confirm("¿Borrar producto?")) { productos = productos.filter(x => x.id !== id); save(); } }
function anularV(idx) {
    const v = ventas[idx];
    const p = productos.find(x => x.id == v.idProd);
    if(p) p.stock += v.cantidad;
    ventas.splice(idx, 1);
    save();
}

function actualizarSelectores() {
    const s = document.getElementById('v-producto');
    const val = s.value;
    s.innerHTML = '<option value="">Seleccione producto...</option>';
    productos.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} (Dispo: ${p.stock})</option>`);
    s.value = val;
}

function limpiarTodo() { if(confirm("¿Deseas resetear todo el sistema?")) { localStorage.clear(); location.reload(); } }

render();