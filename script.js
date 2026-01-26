// Cargar datos al iniciar
let productos = JSON.parse(localStorage.getItem('prods')) || [];
let ventas = JSON.parse(localStorage.getItem('vents')) || [];

// 1. NAVEGACIÓN
function showTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    render();
}

// 2. RENDERIZADO GENERAL (Actualiza todo sin recargar)
function render() {
    // Tabla Productos
    const tbodyP = document.querySelector('#tabla-productos tbody');
    tbodyP.innerHTML = '';
    productos.forEach(p => {
        // % Ganancia = ((Venta - Costo) / Costo) * 100
        const ganancia = (((p.venta - p.costo) / p.costo) * 100).toFixed(1);
        tbodyP.innerHTML += `
            <tr>
                <td>${p.nombre}</td>
                <td class="${p.stock < 5 ? 'stock-bajo' : ''}">${p.stock}</td>
                <td>$${p.venta}</td>
                <td>${ganancia}%</td>
                <td><button onclick="eliminarProducto(${p.id})" class="btn-danger">Eliminar</button></td>
            </tr>`;
    });

    // Tabla Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    tbodyV.innerHTML = '';
    [...ventas].reverse().forEach((v, index) => {
        tbodyV.innerHTML += `
            <tr>
                <td>${v.hora}</td>
                <td>${v.nombre}</td>
                <td>${v.cantidad}</td>
                <td>$${v.total}</td>
                <td>${v.tipo}</td>
                <td><button onclick="anularVenta(${ventas.length - 1 - index})" class="btn-danger">Anular</button></td>
            </tr>`;
    });

    // Actualizar select de productos en ventas
    const select = document.getElementById('v-producto');
    const actual = select.value;
    select.innerHTML = '<option value="">Seleccione producto...</option>';
    productos.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`;
    });
    select.value = actual;
}

// 3. LÓGICA DE PRODUCTOS
document.getElementById('prod-form').addEventListener('submit', (e) => {
    e.preventDefault();
    productos.push({
        id: Date.now(),
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value),
        costo: parseFloat(document.getElementById('p-costo').value),
        venta: parseFloat(document.getElementById('p-venta').value)
    });
    guardarYRefrescar();
    e.target.reset();
});

// 4. LÓGICA DE VENTAS
function actualizarTotalVenta() {
    const idProd = document.getElementById('v-producto').value;
    const cant = document.getElementById('v-cantidad').value;
    const prod = productos.find(p => p.id == idProd);
    const display = document.getElementById('display-total');
    
    if (prod && cant > 0) {
        display.innerText = `Total: $${(prod.venta * cant).toLocaleString()}`;
    } else {
        display.innerText = "Total: $0";
    }
}

document.getElementById('venta-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const idProd = document.getElementById('v-producto').value;
    const cant = parseInt(document.getElementById('v-cantidad').value);
    const prod = productos.find(p => p.id == idProd);

    if (prod && prod.stock >= cant) {
        prod.stock -= cant; // Descontar stock
        ventas.push({
            idProd: prod.id,
            hora: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            nombre: prod.nombre,
            cantidad: cant,
            total: prod.venta * cant,
            tipo: document.getElementById('v-pago').value
        });
        guardarYRefrescar();
        e.target.reset();
        document.getElementById('display-total').innerText = "Total: $0";
    } else {
        alert("Stock insuficiente.");
    }
});

// 5. ANULAR VENTA (Devuelve el stock)
function anularVenta(index) {
    if(confirm("¿Anular esta venta? El stock será devuelto al producto.")) {
        const venta = ventas[index];
        const prod = productos.find(p => p.id == venta.idProd);
        if(prod) prod.stock += venta.cantidad; // Devolver stock
        ventas.splice(index, 1);
        guardarYRefrescar();
    }
}

// 6. PERSISTENCIA Y PDF
function guardarYRefrescar() {
    localStorage.setItem('prods', JSON.stringify(productos));
    localStorage.setItem('vents', JSON.stringify(ventas));
    render();
}

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("FactuManager Pro - Reporte de Ventas", 14, 15);
    doc.autoTable({
        startY: 20,
        head: [['Hora', 'Producto', 'Cant.', 'Total', 'Pago']],
        body: ventas.map(v => [v.hora, v.nombre, v.cantidad, `$${v.total}`, v.tipo])
    });
    doc.save("informe-ventas.pdf");
}

function eliminarProducto(id) {
    if(confirm("¿Eliminar producto del inventario?")) {
        productos = productos.filter(p => p.id !== id);
        guardarYRefrescar();
    }
}

function limpiarTodo() {
    if(confirm("ATENCIÓN: Se borrarán todos los productos y ventas. ¿Continuar?")) {
        localStorage.clear();
        location.reload();
    }
}

// Inicialización
render();