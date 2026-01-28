let productos = JSON.parse(localStorage.getItem('gya_pro_items_v6')) || [];
let ventas = JSON.parse(localStorage.getItem('gya_pro_sales_v6')) || [];
let gastos = JSON.parse(localStorage.getItem('gya_pro_expenses_v6')) || [];

function render() {
    // 1. Inventario
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

    // 2. Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    tbodyV.innerHTML = '';
    [...ventas].reverse().slice(0, 10).forEach((v, i) => {
        tbodyV.innerHTML += `<tr><td>${v.hora}</td><td>${v.nombre}</td><td>$${v.total}</td><td><button onclick="anularV(${ventas.length - 1 - i})" class="btn-del">↩</button></td></tr>`;
    });

    // 3. Gastos
    const tbodyG = document.querySelector('#tabla-gastos tbody');
    tbodyG.innerHTML = '';
    [...gastos].reverse().slice(0, 10).forEach((g, i) => {
        tbodyG.innerHTML += `<tr><td>${g.hora}</td><td>${g.motivo}</td><td style="color:#eb2f06">-$${g.monto}</td><td><button onclick="borrarGasto(${gastos.length - 1 - i})" class="btn-del">X</button></td></tr>`;
    });

    actualizarSelectores();
    actualizarDashboard();
}

function actualizarDashboard() {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString();
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();

    const vDia = ventas.filter(v => v.fechaStr === hoyStr).reduce((s, v) => s + v.total, 0);
    const gDia = gastos.filter(g => g.fechaStr === hoyStr).reduce((s, g) => s + g.monto, 0);

    const vMes = ventas.filter(v => v.mes === mes && v.anio === anio).reduce((s, v) => s + v.total, 0);
    const gMes = gastos.filter(g => g.mes === mes && g.anio === anio).reduce((s, g) => s + g.monto, 0);

    document.getElementById('stat-dia').innerText = `$${(vDia - gDia).toLocaleString()}`;
    document.getElementById('stat-mes').innerText = `$${(vMes - gMes).toLocaleString()}`;
    return { netoDia: vDia - gDia, netoMes: vMes - gMes };
}

// ARREGLO PARA GASTOS: e.preventDefault() evita que la página se recargue
const formGasto = document.getElementById('gasto-form');
if(formGasto) {
    formGasto.addEventListener('submit', function(e) {
        e.preventDefault(); 
        const ahora = new Date();
        const monto = parseFloat(document.getElementById('g-monto').value);
        const motivo = document.getElementById('g-descripcion').value;

        if(!isNaN(monto) && motivo !== "") {
            gastos.push({
                motivo: motivo,
                monto: monto,
                fechaStr: ahora.toLocaleDateString(),
                mes: ahora.getMonth(),
                anio: ahora.getFullYear(),
                hora: ahora.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });
            save(); 
            this.reset();
            alert("Gasto registrado correctamente");
        }
    });
}

// ARREGLO PARA VENTAS
const formVenta = document.getElementById('venta-form');
if(formVenta) {
    formVenta.addEventListener('submit', function(e) {
        e.preventDefault();
        const p = productos.find(x => x.id == document.getElementById('v-producto').value);
        const c = parseInt(document.getElementById('v-cantidad').value);
        if (p && p.stock >= c) {
            const t = new Date();
            p.stock -= c;
            ventas.push({
                idProd: p.id, fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
                hora: t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                nombre: p.nombre, cantidad: c, total: p.venta * c, pago: document.getElementById('v-pago').value
            });
            save(); 
            this.reset();
            document.getElementById('display-total').innerText = "Total: $0.00";
        } else { alert("Sin stock suficiente"); }
    });
}

function save() { 
    localStorage.setItem('gya_pro_items_v6', JSON.stringify(productos)); 
    localStorage.setItem('gya_pro_sales_v6', JSON.stringify(ventas)); 
    localStorage.setItem('gya_pro_expenses_v6', JSON.stringify(gastos)); 
    render(); 
}

function showTab(id) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // Para que funcione en Android/iPhone sin errores:
    const clickedBtn = [...document.querySelectorAll('.nav-item')].find(btn => btn.getAttribute('onclick').includes(id));
    if(clickedBtn) clickedBtn.classList.add('active');
}

document.getElementById('prod-form').addEventListener('submit', function(e) {
    e.preventDefault();
    productos.push({
        id: Date.now(),
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value),
        minimo: parseInt(document.getElementById('p-minimo').value),
        costo: parseFloat(document.getElementById('p-costo').value),
        venta: parseFloat(document.getElementById('p-venta').value)
    });
    save(); this.reset();
});

function borrarP(id) { if(confirm("¿Eliminar producto?")) { productos = productos.filter(x => x.id !== id); save(); } }
function borrarGasto(idx) { if(confirm("¿Eliminar gasto?")) { gastos.splice(idx, 1); save(); } }
function anularV(idx) {
    const v = ventas[idx]; const p = productos.find(x => x.id == v.idProd);
    if(p) p.stock += v.cantidad; ventas.splice(idx, 1); save();
}

function actualizarSelectores() {
    const s = document.getElementById('v-producto');
    if(!s) return;
    const val = s.value;
    s.innerHTML = '<option value="">Seleccione Producto...</option>';
    productos.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`);
    s.value = val;
}

function actualizarTotalVenta() {
    const p = productos.find(x => x.id == document.getElementById('v-producto').value);
    const c = document.getElementById('v-cantidad').value;
    document.getElementById('display-total').innerText = (p && c > 0) ? `Total: $${(p.venta * c).toLocaleString()}` : "Total: $0.00";
}

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const b = actualizarDashboard();
    doc.text("GestionYa PRO - Cierre de Caja", 14, 20);
    doc.text(`Balance Neto: $${b.netoDia}`, 14, 30);
    doc.autoTable({ startY: 40, head: [['Hora', 'Tipo', 'Monto']], 
        body: [ ...ventas.map(v => [v.hora, 'Venta: '+v.nombre, '$'+v.total]), ...gastos.map(g => [g.hora, 'GASTO: '+g.motivo, '-$'+g.monto]) ] 
    });
    doc.save("Cierre_Caja.pdf");
}

function limpiarTodo() { if(confirm("¿Reiniciar sistema?")) { localStorage.clear(); location.reload(); } }

render();