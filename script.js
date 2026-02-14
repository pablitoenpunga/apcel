import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhqEcYI3pnbrx4iGq2E2QMyxbvNdP7UPw",
  authDomain: "gestionya-50887.firebaseapp.com",
  projectId: "gestionya-50887",
  storageBucket: "gestionya-50887.firebasestorage.app",
  messagingSenderId: "501179631478",
  appId: "1:501179631478:web:61989ba4281bcf1246dc57",
  measurementId: "G-2N7BEM0KV9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let productos = [];
let ventas = [];
let gastos = [];
let clientes = []; // Nueva lista
let editandoId = null;
let html5QrCode = null; // Para el scanner

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-display').innerText = user.email;
        vincularBaseDeDatos();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: " + err.message));
});

document.getElementById('btn-register').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if (pass.length < 6) return alert("Mínimo 6 caracteres.");
    createUserWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: " + err.message));
});

window.cerrarSesion = () => signOut(auth);

function vincularBaseDeDatos() {
    const path = `usuarios/${currentUser.uid}`;
    // Productos
    onSnapshot(collection(db, path, "productos"), (snap) => {
        productos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    // Ventas
    onSnapshot(collection(db, path, "ventas"), (snap) => {
        ventas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    // Gastos
    onSnapshot(collection(db, path, "gastos"), (snap) => {
        gastos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    // Clientes (NUEVO)
    onSnapshot(collection(db, path, "clientes"), (snap) => {
        clientes = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
}

function render() {
    // 1. Productos
    const tbodyP = document.querySelector('#tabla-productos tbody');
    if(tbodyP) {
        tbodyP.innerHTML = '';
        productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const esBajo = p.stock <= (p.minimo || 10);
            const ganancia = p.costo > 0 ? (((p.venta - p.costo) / p.costo) * 100).toFixed(0) : 0;
            const codigoStr = p.codigo ? `<br><small style="color:#666">${p.codigo}</small>` : '';
            tbodyP.innerHTML += `
                <tr class="${esBajo ? 'low-stock-row' : ''}">
                    <td>${codigoStr}</td>
                    <td>${p.nombre} ${esBajo ? '⚠️' : ''}</td>
                    <td>${p.stock}</td>
                    <td>$${p.venta}</td>
                    <td class="badge-ganancia">${ganancia}%</td>
                    <td>
                        <button onclick="editarP('${p.id}')" class="btn-edit">✏️</button>
                        <button onclick="borrarP('${p.id}')" class="btn-del">🗑️</button>
                    </td>
                </tr>`;
        });
    }

    // 2. Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    if(tbodyV) {
        tbodyV.innerHTML = '';
        [...ventas].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15).forEach(v => {
            const pagoCorto = v.pago === 'Transferencia' ? 'Transf.' : v.pago;
            tbodyV.innerHTML += `<tr><td>${v.hora}</td><td>${v.nombre}</td><td>${pagoCorto}</td><td>$${v.total}</td><td><button onclick="anularV('${v.id}', '${v.idProd}', ${v.cantidad})" class="btn-del">↩</button></td></tr>`;
        });
    }

    // 3. Gastos
    const tbodyG = document.querySelector('#tabla-gastos tbody');
    if(tbodyG) {
        tbodyG.innerHTML = '';
        [...gastos].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15).forEach(g => {
            tbodyG.innerHTML += `<tr><td>${g.hora}</td><td>${g.motivo}</td><td style="color:#eb2f06">-$${g.monto}</td><td><button onclick="borrarGasto('${g.id}')" class="btn-del">X</button></td></tr>`;
        });
    }

    // 4. Clientes (NUEVO)
    const tbodyC = document.querySelector('#tabla-clientes tbody');
    if(tbodyC) {
        tbodyC.innerHTML = '';
        clientes.forEach(c => {
            const deudaStyle = c.deuda > 0 ? 'color:#eb2f06; font-weight:bold;' : 'color:#079992';
            tbodyC.innerHTML += `
                <tr>
                    <td>${c.nombre}</td>
                    <td>${c.telefono || '-'}</td>
                    <td style="${deudaStyle}">$${c.deuda || 0}</td>
                    <td>
                        <button onclick="pagarDeuda('${c.id}', ${c.deuda})" class="btn-pay">💵 Cobrar</button>
                        <button onclick="borrarCliente('${c.id}')" class="btn-del">X</button>
                    </td>
                </tr>`;
        });
    }

    actualizarSelectores();
    actualizarDashboard();
}

function actualizarDashboard() {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString();
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();

    // Filtramos ventas que NO sean Cuenta Corriente para la caja diaria
    const ventasReales = ventas.filter(v => v.pago !== 'Cuenta Corriente');

    const vDia = ventasReales.filter(v => v.fechaStr === hoyStr).reduce((s, v) => s + v.total, 0);
    const gDia = gastos.filter(g => g.fechaStr === hoyStr).reduce((s, g) => s + g.monto, 0);
    const vMes = ventasReales.filter(v => v.mes === mes && v.anio === anio).reduce((s, v) => s + v.total, 0);
    const gMes = gastos.filter(g => g.mes === mes && g.anio === anio).reduce((s, g) => s + g.monto, 0);

    const diaEl = document.getElementById('stat-dia');
    const mesEl = document.getElementById('stat-mes');
    if(diaEl) diaEl.innerText = `$${(vDia - gDia).toLocaleString()}`;
    if(mesEl) mesEl.innerText = `$${(vMes - gMes).toLocaleString()}`;
    
    return { netoDia: vDia - gDia, netoMes: vMes - gMes };
}

// --- ESCÁNER DE CÓDIGO DE BARRAS ---
window.iniciarScanner = (targetInputId) => {
    document.getElementById('scanner-container').style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            // Éxito
            document.getElementById(targetInputId).value = decodedText;
            if(targetInputId === 'scan-venta') buscarPorCodigo(decodedText);
            cerrarScanner();
        },
        (errorMessage) => { /* ignora errores de frame */ }
    ).catch(err => { alert("Error al abrir cámara"); });
};

window.cerrarScanner = () => {
    if(html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('scanner-container').style.display = 'none';
            html5QrCode.clear();
        });
    } else {
        document.getElementById('scanner-container').style.display = 'none';
    }
};

// Buscar producto por código (Lector USB o Cámara)
function buscarPorCodigo(codigo) {
    const p = productos.find(x => x.codigo === codigo);
    if(p) {
        document.getElementById('v-producto').value = p.id;
        calcularTotal();
        // Feedback visual
        document.getElementById('scan-venta').value = '';
        document.getElementById('v-cantidad').focus();
    } else {
        alert("Producto no encontrado con ese código");
    }
}

// Evento para Lector USB (Enter)
document.getElementById('scan-venta').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') {
        e.preventDefault();
        buscarPorCodigo(e.target.value);
    }
});

// --- CLIENTES (FIADO) ---
document.getElementById('cliente-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/clientes`), {
        nombre: document.getElementById('cli-nombre').value,
        telefono: document.getElementById('cli-telefono').value,
        deuda: 0
    });
    e.target.reset();
    alert("Cliente registrado");
});

window.verificarFiado = () => {
    const pago = document.getElementById('v-pago').value;
    const div = document.getElementById('div-cliente-fiado');
    const input = document.getElementById('v-cliente');
    
    if(pago === 'Cuenta Corriente') {
        div.style.display = 'block';
        input.required = true;
    } else {
        div.style.display = 'none';
        input.required = false;
        input.value = "";
    }
};

window.pagarDeuda = async (id, deudaActual) => {
    const monto = prompt(`El cliente debe $${deudaActual}. ¿Cuánto paga?`);
    if(monto && parseFloat(monto) > 0) {
        const pago = parseFloat(monto);
        const t = new Date();
        
        // 1. Restar deuda
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, id), { 
            deuda: deudaActual - pago 
        });

        // 2. Registrar ingreso en caja (Como una venta especial para que cuadre la caja)
        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            idProd: 'PAGO_DEUDA', nombre: 'COBRO DEUDA CLIENTE', total: pago, cantidad: 1,
            pago: 'Efectivo', fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(), anio: t.getFullYear(), hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });
        alert("Pago registrado y deuda actualizada.");
    }
};

window.borrarCliente = async (id) => { if(confirm("¿Borrar cliente?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, id)); };


// --- FORMULARIOS EXISTENTES ---

// PRODUCTOS (con código de barras)
document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        codigo: document.getElementById('p-codigo').value || "", // Nuevo campo
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        minimo: parseInt(document.getElementById('p-minimo').value) || 0,
        costo: parseFloat(document.getElementById('p-costo').value) || 0,
        venta: parseFloat(document.getElementById('p-venta').value) || 0
    };

    if (editandoId) {
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, editandoId), data);
        alert("Producto actualizado");
        cancelarEdicion();
    } else {
        await addDoc(collection(db, `usuarios/${currentUser.uid}/productos`), data);
        alert("Producto registrado");
        e.target.reset();
    }
});

window.editarP = (id) => {
    const p = productos.find(x => x.id === id);
    if(p) {
        document.getElementById('p-codigo').value = p.codigo || "";
        document.getElementById('p-nombre').value = p.nombre;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-minimo').value = p.minimo;
        document.getElementById('p-costo').value = p.costo;
        document.getElementById('p-venta').value = p.venta;
        
        editandoId = id;
        document.getElementById('btn-save-prod').innerText = "Actualizar Producto";
        document.getElementById('btn-cancel-edit').style.display = "block";
        document.getElementById('prod-form').scrollIntoView({ behavior: 'smooth' });
        showTab('tab-productos');
    }
};

window.cancelarEdicion = () => {
    editandoId = null;
    document.getElementById('prod-form').reset();
    document.getElementById('btn-save-prod').innerText = "Guardar Producto";
    document.getElementById('btn-cancel-edit').style.display = "none";
};

// VENTAS (Con lógica Fiado)
document.getElementById('venta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = document.getElementById('v-producto').value;
    const p = productos.find(x => x.id === pId);
    const cant = parseInt(document.getElementById('v-cantidad').value);
    const tipoPago = document.getElementById('v-pago').value;
    const clienteId = document.getElementById('v-cliente').value;

    if (p && p.stock >= cant) {
        const t = new Date();
        const totalVenta = p.venta * cant;

        // Registrar Venta
        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            idProd: pId, nombre: p.nombre, total: totalVenta, cantidad: cant,
            pago: tipoPago, fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(), anio: t.getFullYear(), hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });

        // Descontar Stock
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { stock: p.stock - cant });

        // Si es FIADO, sumar deuda al cliente
        if(tipoPago === 'Cuenta Corriente' && clienteId) {
            const cli = clientes.find(c => c.id === clienteId);
            if(cli) {
                await updateDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, clienteId), { 
                    deuda: (cli.deuda || 0) + totalVenta 
                });
            }
        }

        e.target.reset();
        document.getElementById('display-total').innerText = "Total: $0.00";
        verificarFiado(); // Resetear vista
    } else { alert("Stock insuficiente"); }
});

// COMPRAS
document.getElementById('compra-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = document.getElementById('c-producto').value;
    const p = productos.find(x => x.id === pId);
    const cant = parseInt(document.getElementById('c-cantidad-stock').value);
    const costoTotal = parseFloat(document.getElementById('c-costo-total-compra').value);
    const margen = parseFloat(document.getElementById('c-margen-ganancia').value);

    if (p && cant > 0 && costoTotal > 0 && margen >= 0) {
        const t = new Date();
        const costoUnitario = costoTotal / cant;
        const precioVentaNuevo = costoUnitario * (1 + (margen / 100));

        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { 
            stock: p.stock + cant,
            costo: Math.ceil(costoUnitario),
            venta: Math.ceil(precioVentaNuevo)
        });
        
        await addDoc(collection(db, `usuarios/${currentUser.uid}/gastos`), {
            motivo: `COMPRA: ${p.nombre} (x${cant})`,
            monto: costoTotal,
            fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
            hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });

        alert("Compra registrada.");
        e.target.reset();
        document.getElementById('display-nuevo-precio').innerText = "$0.00";
    } else { alert("Verificá los datos"); }
});

// SIMULADOR
function simularPrecioCompra() {
    const cant = parseFloat(document.getElementById('c-cantidad-stock').value);
    const costoTotal = parseFloat(document.getElementById('c-costo-total-compra').value);
    const margen = parseFloat(document.getElementById('c-margen-ganancia').value);
    const display = document.getElementById('display-nuevo-precio');

    if(cant > 0 && costoTotal > 0 && margen >= 0) {
        const unitario = costoTotal / cant;
        const precio = unitario * (1 + (margen/100));
        display.innerText = `$${Math.ceil(precio).toLocaleString()}`;
    } else {
        display.innerText = "$0.00";
    }
}
document.getElementById('c-cantidad-stock').addEventListener('input', simularPrecioCompra);
document.getElementById('c-costo-total-compra').addEventListener('input', simularPrecioCompra);
document.getElementById('c-margen-ganancia').addEventListener('input', simularPrecioCompra);

// GASTOS
document.getElementById('gasto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = new Date();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/gastos`), {
        motivo: document.getElementById('g-descripcion').value,
        monto: parseFloat(document.getElementById('g-monto').value),
        fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
        hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        timestamp: Date.now()
    });
    e.target.reset();
});

// ELIMINAR
window.borrarP = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/productos`, id)); };
window.borrarGasto = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/gastos`, id)); };
window.anularV = async (idVenta, idProd, cant) => {
    if(confirm("¿Anular venta?")) {
        await deleteDoc(doc(db, `usuarios/${currentUser.uid}/ventas`, idVenta));
        const p = productos.find(x => x.id === idProd);
        if(p) await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, idProd), { stock: p.stock + cant });
    }
};

window.showTab = (id) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    const titulos = { 'tab-productos': 'Inventario', 'tab-ventas': 'Ventas', 'tab-clientes': 'Clientes', 'tab-compras': 'Compras', 'tab-gastos': 'Gastos', 'tab-informes': 'Reportes' };
    const titleEl = document.getElementById('current-tab-title');
    if(titleEl) titleEl.innerText = titulos[id];

    document.querySelectorAll('.nav-item').forEach(btn => {
        if(btn.getAttribute('onclick').includes(id)) btn.classList.add('active');
    });
};

function actualizarSelectores() {
    const s = document.getElementById('v-producto');
    const c = document.getElementById('c-producto'); 
    const cli = document.getElementById('v-cliente');
    
    const llenar = (selector, lista, labelFn) => {
        if(!selector) return;
        const val = selector.value;
        selector.innerHTML = '<option value="">Seleccione...</option>';
        lista.forEach(item => selector.innerHTML += `<option value="${item.id}">${labelFn(item)}</option>`);
        selector.value = val;
    };

    llenar(s, productos, (p) => `${p.nombre} ($${p.venta})`);
    llenar(c, productos, (p) => `${p.nombre} (Stock: ${p.stock})`);
    llenar(cli, clientes, (cl) => cl.nombre);
}

function calcularTotal() {
    const pId = document.getElementById('v-producto').value;
    const p = productos.find(x => x.id === pId);
    const c = document.getElementById('v-cantidad').value;
    const totalEl = document.getElementById('display-total');
    if (totalEl) totalEl.innerText = (p && c > 0) ? `Total: $${(p.venta * c).toLocaleString()}` : "Total: $0.00";
}

const selectProd = document.getElementById('v-producto');
const inputCant = document.getElementById('v-cantidad');
if(selectProd) selectProd.addEventListener('change', calcularTotal);
if(inputCant) inputCant.addEventListener('input', calcularTotal);

// PDF
window.descargarPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const b = actualizarDashboard();
    const t = new Date();
    const hoyStr = t.toLocaleDateString();

    const ventasHoy = ventas.filter(v => v.fechaStr === hoyStr);
    
    // El PDF solo suma lo que entró en caja (Efectivo y Transferencia) para no mentir con la plata real
    const totalEfectivo = ventasHoy.filter(v => v.pago === 'Efectivo').reduce((s, v) => s + v.total, 0);
    const totalTransf = ventasHoy.filter(v => v.pago === 'Transferencia').reduce((s, v) => s + v.total, 0);

    doc.setFontSize(22);
    doc.setTextColor(30, 55, 153);
    doc.text("GestionYa PRO", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Fecha: ${hoyStr} ${t.toLocaleTimeString()}`, 14, 28);
    
    doc.setDrawColor(200);
    doc.line(14, 32, 196, 32);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`CAJA NETA HOY (Sin Fiado): $${b.netoDia.toLocaleString()}`, 14, 42);
    
    doc.setFontSize(11);
    doc.setTextColor(50);
    doc.text(`• Efectivo: $${totalEfectivo.toLocaleString()}`, 14, 50);
    doc.text(`• Transf: $${totalTransf.toLocaleString()}`, 14, 56);
    
    doc.autoTable({ 
        startY: 75, 
        head: [['Hora', 'Item', 'Pago', 'Monto']], 
        headStyles: { fillColor: [30, 55, 153] },
        body: [ 
            ...ventasHoy.map(v => [v.hora, 'Venta: ' + v.nombre, v.pago, '$' + v.total]), 
            ...gastos.filter(g => g.fechaStr === hoyStr).map(g => [g.hora, 'Gasto: ' + g.motivo, '-', '-$' + g.monto]) 
        ] 
    });
    doc.save(`Cierre_${hoyStr.replace(/\//g, '-')}.pdf`);
};