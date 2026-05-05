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
let sucursalesGlobal = []; 
let editandoId = null;
let html5QrCode = null;

const getSucursal = () => document.getElementById('select-sucursal').value;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-display').innerText = `Legajo: ${user.email.split('@')[0]}`;
        vincularBaseDeDatos();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const legajo = document.getElementById('login-legajo').value.replace(/\s+/g, '');
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, `${legajo}@gestionya.com`, pass).catch(err => {
        console.error("Error Auth:", err);
        if (err.code === 'auth/unauthorized-domain') alert("Firebase bloquea este dominio. Agregalo en Auth Settings.");
        else alert("Legajo o contraseña incorrectos.");
    });
});

document.getElementById('btn-register').addEventListener('click', () => {
    const legajo = document.getElementById('login-legajo').value.replace(/\s+/g, '');
    const pass = document.getElementById('login-pass').value;
    if (pass.length < 6) return alert("Mínimo 6 caracteres.");
    createUserWithEmailAndPassword(auth, `${legajo}@gestionya.com`, pass).catch(err => alert("Error: " + err.message));
});

window.cerrarSesion = () => signOut(auth);

function vincularBaseDeDatos() {
    const path = `usuarios/${currentUser.uid}`;
    onSnapshot(collection(db, path, "sucursales"), (snap) => { 
        sucursalesGlobal = snap.docs.map(d => ({id: d.id, ...d.data()})); 
        actualizarSelectoresSucursal(); 
    });
    onSnapshot(collection(db, path, "productos"), (snap) => { productosGlobal = snap.docs.map(d => ({id: d.id, ...d.data()})); render(); });
    onSnapshot(collection(db, path, "ventas"), (snap) => { ventasGlobal = snap.docs.map(d => ({id: d.id, ...d.data()})); render(); });
    onSnapshot(collection(db, path, "gastos"), (snap) => { gastosGlobal = snap.docs.map(d => ({id: d.id, ...d.data()})); render(); });
    onSnapshot(collection(db, path, "clientes"), (snap) => { clientesGlobal = snap.docs.map(d => ({id: d.id, ...d.data()})); render(); });
}

function actualizarSelectoresSucursal() {
    const selector = document.getElementById('select-sucursal');
    const valorPrevio = selector.value;
    selector.innerHTML = '<option value="Global">🌍 Vista Global (Todas)</option>';
    
    sucursalesGlobal.sort((a,b)=>a.nombre.localeCompare(b.nombre)).forEach(s => {
        selector.innerHTML += `<option value="${s.nombre}">🏪 ${s.nombre}</option>`;
    });
    
    if(sucursalesGlobal.some(s => s.nombre === valorPrevio)) selector.value = valorPrevio;

    const tbodyS = document.querySelector('#tabla-sucursales tbody');
    if(tbodyS) {
        tbodyS.innerHTML = '';
        sucursalesGlobal.forEach(s => {
            tbodyS.innerHTML += `<tr><td>${s.nombre}</td><td style="text-align:right;"><button onclick="borrarSucursal('${s.id}')" class="btn-del">X</button></td></tr>`;
        });
    }
}

document.getElementById('sucursal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('s-nombre').value;
    if(sucursalesGlobal.some(s => s.nombre.toLowerCase() === nombre.toLowerCase())) return alert("Esa sucursal ya existe.");
    await addDoc(collection(db, `usuarios/${currentUser.uid}/sucursales`), { nombre });
    e.target.reset();
});

window.borrarSucursal = async (id) => { if(confirm("¿Borrar sucursal?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/sucursales`, id)); };

window.cambiarSucursal = () => {
    const suc = getSucursal();
    const esGlobal = (suc === 'Global');
    
    document.getElementById('btn-save-prod').disabled = esGlobal;
    document.getElementById('btn-confirm-venta').disabled = esGlobal;
    document.getElementById('btn-save-compra').disabled = esGlobal;
    document.getElementById('btn-save-gasto').disabled = esGlobal;
    
    if(esGlobal) alert("Estás en Vista Global. Podés ver reportes y stock general, pero no operar.");
    render();
};

// UI TIPO BULTO / GRAMOS
window.toggleBulto = () => {
    const tipo = document.getElementById('p-tipo').value;
    document.getElementById('div-bulto').style.display = tipo === 'unidad' ? 'flex' : 'none';
};

function render() {
    const sucursal = getSucursal();
    const productos = sucursal === 'Global' ? productosGlobal : productosGlobal.filter(p => p.sucursal === sucursal);
    const ventas = sucursal === 'Global' ? ventasGlobal : ventasGlobal.filter(v => v.sucursal === sucursal);
    const gastos = sucursal === 'Global' ? gastosGlobal : gastosGlobal.filter(g => g.sucursal === sucursal);
    const clientes = clientesGlobal; 

    const tbodyP = document.querySelector('#tabla-productos tbody');
    if(tbodyP) {
        tbodyP.innerHTML = '';
        productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const esBajo = p.stock <= (p.minimo || 10);
            const esGramos = (p.tipo === 'gramos');
            const tipoLabel = esGramos ? 'G' : 'U';
            
            let promoBadges = "";
            if (p.ofertas && p.ofertas.length > 0) {
                p.ofertas.sort((a,b)=>b.cant - a.cant).forEach(off => {
                    promoBadges += `<span class="badge-promo">${off.cant}x$${off.precio}</span> `;
                });
            }

            tbodyP.innerHTML += `
                <tr class="${esBajo ? 'low-stock-row' : ''}">
                    <td>${p.nombre} ${esBajo ? '⚠️' : ''} <small style="color:#888">(${p.sucursal})</small></td>
                    <td>${p.stock} ${tipoLabel}</td>
                    <td>$${p.venta}</td>
                    <td>${promoBadges}</td>
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
                    <td><button onclick="pagarDeuda('${c.id}', ${c.deuda})" class="btn-pay">💵</button></td>
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

window.calcularArqueo = () => {
    const total = 
        ((parseInt(document.getElementById('b-10000').value) || 0) * 10000) +
        ((parseInt(document.getElementById('b-2000').value) || 0) * 2000) +
        ((parseInt(document.getElementById('b-1000').value) || 0) * 1000) +
        ((parseInt(document.getElementById('b-500').value) || 0) * 500) +
        ((parseInt(document.getElementById('b-200').value) || 0) * 200) +
        ((parseInt(document.getElementById('b-100').value) || 0) * 100);
    document.getElementById('arq-total').innerText = `$${total.toLocaleString()}`;
};

window.agregarFilaOferta = (cant = '', precio = '') => {
    const div = document.createElement('div');
    div.className = 'oferta-row';
    div.innerHTML = `
        <input type="number" placeholder="Llevando (ej: 12)" value="${cant}" class="input-oferta-cant" required>
        <input type="number" placeholder="Total a cobrar $" value="${precio}" class="input-oferta-precio" required>
        <button type="button" class="btn-del" onclick="this.parentElement.remove()">X</button>
    `;
    document.getElementById('ofertas-container').appendChild(div);
};

document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;

    const filasOfertas = document.querySelectorAll('.oferta-row');
    let ofertasArreglo = [];
    filasOfertas.forEach(fila => {
        const c = parseInt(fila.querySelector('.input-oferta-cant').value);
        const p = parseFloat(fila.querySelector('.input-oferta-precio').value);
        if(c > 0 && p > 0) ofertasArreglo.push({ cant: c, precio: p });
    });

    const data = {
        sucursal: getSucursal(), 
        codigo: document.getElementById('p-codigo').value || "",
        nombre: document.getElementById('p-nombre').value,
        tipo: document.getElementById('p-tipo').value || "unidad",
        unidadesPorBulto: parseInt(document.getElementById('p-unidades-bulto').value) || 1, // GUARDAMOS EL CAJÓN
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        minimo: parseInt(document.getElementById('p-minimo').value) || 0,
        costo: parseFloat(document.getElementById('p-costo').value) || 0,
        venta: parseFloat(document.getElementById('p-venta').value) || 0,
        ofertas: ofertasArreglo 
    };

    if (editandoId) {
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, editandoId), data);
        alert("Producto actualizado");
        cancelarEdicion();
    } else {
        await addDoc(collection(db, `usuarios/${currentUser.uid}/productos`), data);
        alert("Producto registrado en " + getSucursal());
        e.target.reset();
        document.getElementById('ofertas-container').innerHTML = '';
        window.toggleBulto();
    }
});

window.editarP = (id) => {
    const p = productosGlobal.find(x => x.id === id);
    if(p) {
        document.getElementById('p-codigo').value = p.codigo || "";
        document.getElementById('p-nombre').value = p.nombre;
        document.getElementById('p-tipo').value = p.tipo || "unidad";
        document.getElementById('p-unidades-bulto').value = p.unidadesPorBulto || 1;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-minimo').value = p.minimo;
        document.getElementById('p-costo').value = p.costo;
        document.getElementById('p-venta').value = p.venta;
        
        document.getElementById('ofertas-container').innerHTML = '';
        if(p.ofertas) p.ofertas.forEach(off => window.agregarFilaOferta(off.cant, off.precio));

        window.toggleBulto();
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
    document.getElementById('ofertas-container').innerHTML = '';
    document.getElementById('btn-save-prod').innerText = "Guardar Producto";
    document.getElementById('btn-cancel-edit').style.display = "none";
    window.toggleBulto();
};

// --- CÁLCULO DE VENTA (EL CEREBRO DE LOS BULTOS) ---
function getCantidadTotalIngresada(p) {
    if (!p) return 0;
    if (p.tipo !== 'gramos' && p.unidadesPorBulto > 1) {
        // Multiplica solo y suma las unidades sueltas
        const cajones = parseFloat(document.getElementById('v-cajones').value) || 0;
        const sueltas = parseFloat(document.getElementById('v-sueltas').value) || 0;
        return (cajones * p.unidadesPorBulto) + sueltas;
    }
    return parseFloat(document.getElementById('v-cantidad').value) || 0;
}

function evaluarVenta(p, cantComprada) {
    const esGramos = (p.tipo === 'gramos');
    let total = 0;
    
    if (esGramos) {
        total = (p.venta / 1000) * cantComprada;
        return { total, esPromo: false };
    }

    let cantidadRestante = cantComprada;
    let aplicoPromo = false;

    if (p.ofertas && p.ofertas.length > 0) {
        const ofertasOrdenadas = [...p.ofertas].sort((a,b) => b.cant - a.cant);
        ofertasOrdenadas.forEach(off => {
            if (cantidadRestante >= off.cant) {
                const promosEnteras = Math.floor(cantidadRestante / off.cant);
                total += promosEnteras * off.precio; 
                cantidadRestante = cantidadRestante % off.cant; 
                aplicoPromo = true;
            }
        });
    }
    total += cantidadRestante * p.venta;
    return { total, esPromo: aplicoPromo };
}

document.getElementById('venta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(getSucursal() === 'Global') return;

    const pId = document.getElementById('v-producto').value;
    const p = productosGlobal.find(x => x.id === pId);
    const cantFinal = getCantidadTotalIngresada(p);
    const tipoPago = document.getElementById('v-pago').value;
    const clienteId = document.getElementById('v-cliente').value;

    if (p && cantFinal > 0 && p.stock >= cantFinal) {
        const t = new Date();
        const esGramos = (p.tipo === 'gramos');
        
        const result = evaluarVenta(p, cantFinal);
        const totalVenta = result.total;
        let totalCostoParaGanancia = esGramos ? (p.costo / 1000) * cantFinal : p.costo * cantFinal;

        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            sucursal: getSucursal(), 
            idProd: pId, 
            nombre: p.nombre, 
            total: Math.ceil(totalVenta), 
            cantidad: cantFinal, 
            costo: Math.ceil(totalCostoParaGanancia),
            esGranel: esGramos, 
            pago: tipoPago, 
            fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(), anio: t.getFullYear(), hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });

        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { stock: p.stock - cantFinal });

        if(tipoPago === 'Cuenta Corriente' && clienteId) {
            const cli = clientesGlobal.find(c => c.id === clienteId);
            if(cli) await updateDoc(doc(db, `usuarios/${currentUser.uid}/clientes`, clienteId), { deuda: (cli.deuda || 0) + totalVenta });
        }

        e.target.reset();
        document.getElementById('display-total').innerText = "Total: $0.00";
        verificarFiado();
        document.getElementById('v-producto').dispatchEvent(new Event('change')); // Resetea las cajitas
    } else { alert("Stock insuficiente o no ingresaste cantidad"); }
});

function calcularTotal() {
    const pId = document.getElementById('v-producto').value;
    const p = productosGlobal.find(x => x.id === pId);
    const c = getCantidadTotalIngresada(p);
    const totalEl = document.getElementById('display-total');
    
    if (totalEl) {
        if (p && c > 0) {
            const res = evaluarVenta(p, c);
            if (res.esPromo) {
                totalEl.innerHTML = `Total: $${Math.ceil(res.total).toLocaleString()} <br><small style="color:#d35400">¡Promo Aplicada!</small>`;
            } else {
                totalEl.innerText = `Total: $${Math.ceil(res.total).toLocaleString()}`;
            }
        } else {
            totalEl.innerText = "Total: $0.00";
        }
    }
}

document.getElementById('v-producto').addEventListener('change', calcularTotal);
document.getElementById('v-cantidad').addEventListener('input', calcularTotal);
document.getElementById('v-cajones').addEventListener('input', calcularTotal);
document.getElementById('v-sueltas').addEventListener('input', calcularTotal);

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

window.iniciarScanner = (targetInputId) => {
    document.getElementById('scanner-container').style.display = 'flex';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            if(targetInputId === 'scan-venta') {
                const p = productosGlobal.filter(x => x.sucursal === getSucursal()).find(x => x.codigo === decodedText);
                if(p) { document.getElementById('v-producto').value = p.id; document.getElementById('v-producto').dispatchEvent(new Event('change')); }
            }
            cerrarScanner();
        }, (errorMessage) => {}).catch(err => { alert("Error cámara"); });
};
window.cerrarScanner = () => { if(html5QrCode) { html5QrCode.stop().then(() => { document.getElementById('scanner-container').style.display = 'none'; html5QrCode.clear(); }); } else { document.getElementById('scanner-container').style.display = 'none'; } };

window.showTab = (id) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(btn => { if(btn.getAttribute('onclick').includes(id)) btn.classList.add('active'); });
};

// UI DINÁMICA DE VENTAS (Muestra cajas según el tipo de producto)
function actualizarSelectores(prodsLocal) {
    const s = document.getElementById('v-producto');
    const c = document.getElementById('c-producto'); 
    const cli = document.getElementById('v-cliente');
    
    if(s) {
        const val = s.value; s.innerHTML = '<option value="">Seleccione...</option>';
        prodsLocal.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} ($${p.venta})</option>`);
        s.value = val;
        
        // El evento que cambia las cajitas de input
        s.onchange = (e) => {
            const prod = prodsLocal.find(x => x.id === e.target.value);
            const iCant = document.getElementById('v-cantidad');
            const iCaj = document.getElementById('v-cajones');
            const iSue = document.getElementById('v-sueltas');
            
            if(prod) {
                if(prod.tipo === 'gramos') {
                    iCant.style.display = 'block'; iCant.placeholder = "Gramos (Ej: 250)"; iCant.required = true;
                    iCaj.style.display = 'none'; iCaj.required = false; iCaj.value = '';
                    iSue.style.display = 'none'; iSue.required = false; iSue.value = '';
                } else if (prod.unidadesPorBulto > 1) {
                    // Si trae más de 1 unidad por cajón, mostramos la calculadora mágica
                    iCant.style.display = 'none'; iCant.required = false; iCant.value = '';
                    iCaj.style.display = 'block'; iCaj.required = true; iCaj.placeholder = `Cajones (de ${prod.unidadesPorBulto}u)`;
                    iSue.style.display = 'block'; iSue.required = true;
                } else {
                    iCant.style.display = 'block'; iCant.placeholder = "Cant. Unidades"; iCant.required = true;
                    iCaj.style.display = 'none'; iCaj.required = false; iCaj.value = '';
                    iSue.style.display = 'none'; iSue.required = false; iSue.value = '';
                }
            }
        };
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