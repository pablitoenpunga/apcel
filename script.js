import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

enableIndexedDbPersistence(db).catch(err => console.warn("Modo offline advertencia:", err));

let currentUser = null;
let productosGlobal = [];
let ventasGlobal = [];
let gastosGlobal = [];
let clientesGlobal = [];
let editandoId = null;
let html5QrCode = null;

// Obtenemos la sucursal activa del selector
const getSucursal = () => document.getElementById('select-sucursal').value;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        // Mostramos el Legajo extrayéndolo del mail falso
        document.getElementById('user-display').innerText = `Legajo: ${user.email.split('@')[0]}`;
        vincularBaseDeDatos();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

// LOGICA DE LEGAJO
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const legajo = document.getElementById('login-legajo').value;
    const pass = document.getElementById('login-pass').value;
    const email = `${legajo}@gestionya.com`; // Transformamos el legajo en mail invisible
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: Verificá tu legajo y contraseña."));
});

document.getElementById('btn-register').addEventListener('click', () => {
    const legajo = document.getElementById('login-legajo').value;
    const pass = document.getElementById('login-pass').value;
    if (pass.length < 6) return alert("Mínimo 6 caracteres.");
    const email = `${legajo}@gestionya.com`;
    createUserWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: " + err.message));
});

window.cerrarSesion = () => signOut(auth);

function vincularBaseDeDatos() {
    const path = `usuarios/${currentUser.uid}`;
    onSnapshot(collection(db, path, "productos"), (snap) => {
        productosGlobal = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    onSnapshot(collection(db, path, "ventas"), (snap) => {
        ventasGlobal = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    onSnapshot(collection(db, path, "gastos"), (snap) => {
        gastosGlobal = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    onSnapshot(collection(db, path, "clientes"), (snap) => {
        clientesGlobal = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
}

// MULTISUCURSAL: Bloquear formularios si estamos en "Global"
window.cambiarSucursal = () => {
    const suc = getSucursal();
    const esGlobal = (suc === 'Global');
    
    document.getElementById('btn-save-prod').disabled = esGlobal;
    document.getElementById('btn-confirm-venta').disabled = esGlobal;
    document.getElementById('btn-save-compra').disabled = esGlobal;
    document.getElementById('btn-save-gasto').disabled = esGlobal;
    
    if(esGlobal) alert("Estás en Vista Global. Podés ver los reportes y stock general, pero no podés vender ni modificar productos. Elegí un Local para operar.");
    render();
};

function render() {
    const sucursal = getSucursal();
    
    // Filtramos los datos según la sucursal (Si es Global, mostramos todo)
    const productos = sucursal === 'Global' ? productosGlobal : productosGlobal.filter(p => p.sucursal === sucursal);
    const ventas = sucursal === 'Global' ? ventasGlobal : ventasGlobal.filter(v => v.sucursal === sucursal);
    const gastos = sucursal === 'Global' ? gastosGlobal : gastosGlobal.filter(g => g.sucursal === sucursal);
    const clientes = clientesGlobal; // Los clientes son compartidos entre locales

    const tbodyP = document.querySelector('#tabla-productos tbody');
    if(tbodyP) {
        tbodyP.innerHTML = '';
        productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const esBajo = p.stock <= (p.minimo || 10);
            const esGramos = (p.tipo === 'gramos');
            const tipoLabel = esGramos ? 'G' : 'U';
            
            // Etiqueta de Promo si existe
            let promoBadge = "";
            if(p.ofertaCant && p.ofertaPrecio) {
                promoBadge = `<br><span class="badge-promo">${p.ofertaCant}x$${p.ofertaPrecio}</span>`;
            }

            tbodyP.innerHTML += `
                <tr class="${esBajo ? 'low-stock-row' : ''}">
                    <td>${p.nombre} ${esBajo ? '⚠️' : ''} <small style="color:#888">(${p.sucursal})</small></td>
                    <td>${p.stock} ${tipoLabel}</td>
                    <td>$${p.venta}</td>
                    <td>${promoBadge}</td>
                    <td>
                        <button onclick="editarP('${p.id}')" class="btn-edit" ${sucursal === 'Global' ? 'disabled' : ''}>✏️</button>
                        <button onclick="borrarP('${p.id}')" class="btn-del" ${sucursal === 'Global' ? 'disabled' : ''}>🗑️</button>
                    </td>
                </tr>`;
        });
    }

    const tbodyV = document.querySelector('#tabla-ventas tbody');
    if(tbodyV) {
        tbodyV.innerHTML = '';
        [...ventas].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15).forEach(v => {
            const pagoCorto = v.pago === 'Transferencia' ? 'Transf.' : v.pago;
            tbodyV.innerHTML += `<tr><td>${v.hora}</td><td>${v.cantidad} ${v.nombre}</td><td>${pagoCorto}</td><td>$${v.total}</td><td><button onclick="anularV('${v.id}', '${v.idProd}', ${v.cantidad})" class="btn-del">↩</button></td></tr>`;
        });
    }

    const tbodyG = document.querySelector('#tabla-gastos tbody');
    if(tbodyG) {
        tbodyG.innerHTML = '';
        [...gastos].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15).forEach(g => {
            tbodyG.innerHTML += `<tr><td>${g.hora}</td><td>${g.motivo}</td><td style="color:#eb2f06">-$${g.monto}</td><td><button onclick="borrarGasto('${g.id}')" class="btn-del">X</button></td></tr>`;
        });
    }

    const tbodyC = document.querySelector('#tabla-clientes tbody');
    if(tbodyC) {
        tbodyC.innerHTML = '';
        clientes.forEach(c => {
            const deudaStyle = c.deuda > 0 ? 'color:#eb2f06; font-weight:bold;' : 'color:#079992';
            tbodyC.innerHTML += `
                <tr>
                    <td>${c.nombre}</td>
                    <td style="${deudaStyle}">$${c.deuda || 0}</td>
                    <td>
                        <button onclick="pagarDeuda('${c.id}', ${c.deuda})" class="btn-pay">💵</button>
                    </td>
                </tr>`;
        });
    }

    actualizarSelectores(productos);
    actualizarDashboard(ventas, gastos);
}

function actualizarDashboard(ventasLocales, gastosLocales) {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString();
    const mes = ahora.getMonth();
    const anio = ahora.getFullYear();

    const ventasReales = ventasLocales.filter(v => v.pago !== 'Cuenta Corriente');

    const vDia = ventasReales.filter(v => v.fechaStr === hoyStr).reduce((s, v) => s + v.total, 0);
    const gDia = gastosLocales.filter(g => g.fechaStr === hoyStr).reduce((s, g) => s + g.monto, 0);
    const vMes = ventasReales.filter(v => v.mes === mes && v.anio === anio).reduce((s, v) => s + v.total, 0);
    const gMes = gastosLocales.filter(g => g.mes === mes && g.anio === anio).reduce((s, g) => s + g.monto, 0);

    const diaEl = document.getElementById('stat-dia');
    const mesEl = document.getElementById('stat-mes');
    if(diaEl) diaEl.innerText = `$${(vDia - gDia).toLocaleString()}`;
    if(mesEl) mesEl.innerText = `$${(vMes - gMes).toLocaleString()}`;
    
    return { netoDia: vDia - gDia, netoMes: vMes - gMes, ventasHoy: ventasLocales.filter(v => v.fechaStr === hoyStr) };
}

// ARQUEO DE CAJA
window.calcularArqueo = () => {
    const b10000 = (parseInt(document.getElementById('b-10000').value) || 0) * 10000;
    const b2000 = (parseInt(document.getElementById('b-2000').value) || 0) * 2000;
    const b1000 = (parseInt(document.getElementById('b-1000').value) || 0) * 1000;
    const b500 = (parseInt(document.getElementById('b-500').value) || 0) * 500;
    const b200 = (parseInt(document.getElementById('b-200').value) || 0) * 200;
    const b100 = (parseInt(document.getElementById('b-100').value) || 0) * 100;
    
    const total = b10000 + b2000 + b1000 + b500 + b200 + b100;
    document.getElementById('arq-total').innerText = `$${total.toLocaleString()}`;
};

// OFERTAS CHECKBOX
window.toggleOferta = () => {
    const isChecked = document.getElementById('p-tiene-oferta').checked;
    document.getElementById('div-oferta').style.display = isChecked ? 'block' : 'none';
};

// --- PRODUCTOS ---
document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;

    const data = {
        sucursal: getSucursal(), // Agregamos la sucursal
        codigo: document.getElementById('p-codigo').value || "",
        nombre: document.getElementById('p-nombre').value,
        tipo: document.getElementById('p-tipo').value || "unidad",
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        minimo: parseInt(document.getElementById('p-minimo').value) || 0,
        costo: parseFloat(document.getElementById('p-costo').value) || 0,
        venta: parseFloat(document.getElementById('p-venta').value) || 0,
        // Guardar ofertas si el checkbox está activo
        ofertaCant: document.getElementById('p-tiene-oferta').checked ? parseInt(document.getElementById('p-oferta-cant').value) : null,
        ofertaPrecio: document.getElementById('p-tiene-oferta').checked ? parseFloat(document.getElementById('p-oferta-precio').value) : null
    };

    if (editandoId) {
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, editandoId), data);
        alert("Producto actualizado");
        cancelarEdicion();
    } else {
        await addDoc(collection(db, `usuarios/${currentUser.uid}/productos`), data);
        alert("Producto registrado en " + getSucursal());
        e.target.reset();
        document.getElementById('div-oferta').style.display = 'none';
    }
});

// --- VENTAS CON LÓGICA DE OFERTAS ---
document.getElementById('venta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;

    const pId = document.getElementById('v-producto').value;
    const p = productosGlobal.find(x => x.id === pId);
    const cant = parseFloat(document.getElementById('v-cantidad').value);
    const tipoPago = document.getElementById('v-pago').value;
    const clienteId = document.getElementById('v-cliente').value;

    if (p && p.stock >= cant) {
        const t = new Date();
        const esGramos = (p.tipo === 'gramos');
        
        // MATEMÁTICA DE VENTA NORMAL
        let totalVenta = esGramos ? (p.venta / 1000) * cant : p.venta * cant;
        let totalCostoParaGanancia = esGramos ? (p.costo / 1000) * cant : p.costo * cant;

        // MATEMÁTICA DE OFERTAS (Si lleva la cantidad necesaria, aplicamos la promo)
        if (!esGramos && p.ofertaCant && p.ofertaPrecio && cant >= p.ofertaCant) {
            const cantPromos = Math.floor(cant / p.ofertaCant); // Cuántas promociones enteras lleva (Ej: lleva 7, promo es 3. Lleva 2 promos)
            const cantSueltos = cant % p.ofertaCant; // Cuántos sueltos le quedan (Ej: 1)
            totalVenta = (cantPromos * p.ofertaPrecio) + (cantSueltos * p.venta);
        }

        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            sucursal: getSucursal(), // Se registra en la sucursal actual
            idProd: pId, 
            nombre: p.nombre, 
            total: Math.ceil(totalVenta), 
            cantidad: cant, 
            costo: Math.ceil(totalCostoParaGanancia),
            esGranel: esGramos, 
            pago: tipoPago, 
            fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(), anio: t.getFullYear(), hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });

        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { stock: p.stock - cant });

        if(tipoPago === 'Cuenta Corriente' && clienteId) {
            const cli = clientesGlobal.find(c => c.id === clienteId);
            if(cli) await updateDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, clienteId), { deuda: (cli.deuda || 0) + totalVenta });
        }

        e.target.reset();
        document.getElementById('display-total').innerText = "Total: $0.00";
        verificarFiado(); 
    } else { alert("Stock insuficiente o inválido"); }
});

function calcularTotal() {
    const pId = document.getElementById('v-producto').value;
    const p = productosGlobal.find(x => x.id === pId);
    const c = parseFloat(document.getElementById('v-cantidad').value);
    const totalEl = document.getElementById('display-total');
    
    if (totalEl) {
        if (p && c > 0) {
            const esGramos = (p.tipo === 'gramos');
            let total = esGramos ? (p.venta / 1000) * c : p.venta * c;
            
            // Mostrar la promo en vivo en el cajero
            if (!esGramos && p.ofertaCant && p.ofertaPrecio && c >= p.ofertaCant) {
                const cantPromos = Math.floor(c / p.ofertaCant);
                const cantSueltos = c % p.ofertaCant;
                total = (cantPromos * p.ofertaPrecio) + (cantSueltos * p.venta);
                totalEl.innerHTML = `Total: $${Math.ceil(total).toLocaleString()} <br><small style="color:#d35400">¡Promo Aplicada!</small>`;
            } else {
                totalEl.innerText = `Total: $${Math.ceil(total).toLocaleString()}`;
            }
        } else {
            totalEl.innerText = "Total: $0.00";
        }
    }
}
document.getElementById('v-producto').addEventListener('change', calcularTotal);
document.getElementById('v-cantidad').addEventListener('input', calcularTotal);

// --- COMPRAS ---
document.getElementById('compra-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;
    const pId = document.getElementById('c-producto').value;
    const p = productosGlobal.find(x => x.id === pId);
    const cant = parseFloat(document.getElementById('c-cantidad-stock').value);
    const costoTotal = parseFloat(document.getElementById('c-costo-total-compra').value);
    const margen = parseFloat(document.getElementById('c-margen-ganancia').value);

    if (p && cant > 0 && costoTotal > 0 && margen >= 0) {
        const t = new Date();
        const costoUnitario = costoTotal / cant;
        const precioVentaNuevo = costoUnitario * (1 + (margen / 100));

        const esGramos = (p.tipo === 'gramos');
        const guardarCosto = esGramos ? (costoUnitario * 1000) : costoUnitario;
        const guardarVenta = esGramos ? (precioVentaNuevo * 1000) : precioVentaNuevo;

        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { 
            stock: p.stock + cant,
            costo: Math.ceil(guardarCosto),
            venta: Math.ceil(guardarVenta)
        });
        
        await addDoc(collection(db, `usuarios/${currentUser.uid}/gastos`), {
            sucursal: getSucursal(),
            motivo: `COMPRA: ${p.nombre}`,
            monto: costoTotal,
            fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
            hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });

        alert("Compra registrada.");
        e.target.reset();
    }
});

// --- GASTOS ---
document.getElementById('gasto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;
    const t = new Date();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/gastos`), {
        sucursal: getSucursal(),
        motivo: document.getElementById('g-descripcion').value,
        monto: parseFloat(document.getElementById('g-monto').value),
        fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
        hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        timestamp: Date.now()
    });
    e.target.reset();
});

// ESCANER
window.iniciarScanner = (targetInputId) => {
    document.getElementById('scanner-container').style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            if(targetInputId === 'scan-venta') {
                const p = productosGlobal.filter(x => x.sucursal === getSucursal()).find(x => x.codigo === decodedText);
                if(p) { document.getElementById('v-producto').value = p.id; calcularTotal(); document.getElementById('v-cantidad').focus(); }
            }
            cerrarScanner();
        }, (errorMessage) => {}).catch(err => { alert("Error cámara"); });
};
window.cerrarScanner = () => { if(html5QrCode) { html5QrCode.stop().then(() => { document.getElementById('scanner-container').style.display = 'none'; html5QrCode.clear(); }); } else { document.getElementById('scanner-container').style.display = 'none'; } };

// NAVEGACION Y SELECTORES
window.showTab = (id) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => { if(btn.getAttribute('onclick').includes(id)) btn.classList.add('active'); });
};

function actualizarSelectores(prodsLocal) {
    const s = document.getElementById('v-producto');
    const c = document.getElementById('c-producto'); 
    const cli = document.getElementById('v-cliente');
    
    if(s) {
        const val = s.value; s.innerHTML = '<option value="">Seleccione...</option>';
        prodsLocal.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} ($${p.venta})</option>`);
        s.value = val;
    }
    if(c) {
        const val = c.value; c.innerHTML = '<option value="">Seleccione...</option>';
        prodsLocal.forEach(p => c.innerHTML += `<option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>`);
        c.value = val;
    }
    if(cli) {
        const val = cli.value; cli.innerHTML = '<option value="">Seleccione...</option>';
        clientesGlobal.forEach(cl => cli.innerHTML += `<option value="${cl.id}">${cl.nombre}</option>`);
        cli.value = val;
    }
}

// RESTO DE FUNCIONES (BORRAR, PDF, CLIENTES) QUEDAN INTACTAS
window.borrarP = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/productos`, id)); };
window.borrarGasto = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/gastos`, id)); };
window.anularV = async (idVenta, idProd, cant) => { if(confirm("¿Anular?")) { await deleteDoc(doc(db, `usuarios/${currentUser.uid}/ventas`, idVenta)); const p = productosGlobal.find(x => x.id === idProd); if(p) await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, idProd), { stock: p.stock + cant }); } };
window.reiniciarMes = async () => {
    const suc = getSucursal();
    if(suc === 'Global') return alert("Elegí un local específico para borrar sus datos.");
    if (prompt("Escribí BORRAR:") === "BORRAR") {
        const t = new Date();
        const vMes = ventasGlobal.filter(v => v.mes === t.getMonth() && v.anio === t.getFullYear() && v.sucursal === suc);
        const gMes = gastosGlobal.filter(g => g.mes === t.getMonth() && g.anio === t.getFullYear() && g.sucursal === suc);
        for (const v of vMes) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/ventas`, v.id));
        for (const g of gMes) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/gastos`, g.id));
        alert("Reiniciado.");
    }
};
window.verificarFiado = () => { document.getElementById('div-cliente-fiado').style.display = document.getElementById('v-pago').value === 'Cuenta Corriente' ? 'block' : 'none'; };
window.pagarDeuda = async (id, deuda) => {
    const m = prompt(`Debe $${deuda}. Paga:`);
    if(m && parseFloat(m) > 0) {
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, id), { deuda: deuda - parseFloat(m) });
        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), { sucursal: getSucursal(), idProd: 'PAGO', nombre: 'COBRO DEUDA', total: parseFloat(m), cantidad: 1, costo: 0, pago: 'Efectivo', fechaStr: new Date().toLocaleDateString(), mes: new Date().getMonth(), anio: new Date().getFullYear(), hora: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), timestamp: Date.now() });
    }
};

window.descargarPDF = () => {
    const suc = getSucursal();
    const ventasReporte = suc === 'Global' ? ventasGlobal : ventasGlobal.filter(v => v.sucursal === suc);
    const gastosReporte = suc === 'Global' ? gastosGlobal : gastosGlobal.filter(g => g.sucursal === suc);
    const dashboardData = actualizarDashboard(ventasReporte, gastosReporte);
    
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(30, 55, 153); doc.text(`GestionYa PRO - ${suc}`, 14, 20);
    doc.setFontSize(14); doc.setTextColor(0); doc.text(`Ingresos Brutos en Caja: $${dashboardData.netoDia.toLocaleString()}`, 14, 42);
    
    doc.autoTable({ 
        startY: 60, head: [['Hora', 'Item', 'Pago', 'Monto']], 
        body: [ ...dashboardData.ventasHoy.map(v => [v.hora, 'Venta: ' + v.nombre, v.pago, '$' + v.total]), ...gastosReporte.filter(g => g.fechaStr === new Date().toLocaleDateString()).map(g => [g.hora, 'Gasto: ' + g.motivo, '-', '-$' + g.monto]) ] 
    });
    doc.save(`Cierre_${suc}.pdf`);
};