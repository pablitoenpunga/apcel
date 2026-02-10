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
let editandoId = null;

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
    onSnapshot(collection(db, path, "productos"), (snap) => {
        productos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    onSnapshot(collection(db, path, "ventas"), (snap) => {
        ventas = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
    onSnapshot(collection(db, path, "gastos"), (snap) => {
        gastos = snap.docs.map(d => ({id: d.id, ...d.data()}));
        render();
    });
}

function render() {
    // 1. Productos (RESTAURADO: % GANANCIA)
    const tbodyP = document.querySelector('#tabla-productos tbody');
    if(tbodyP) {
        tbodyP.innerHTML = '';
        productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const esBajo = p.stock <= (p.minimo || 10);
            // Cálculo de ganancia
            const ganancia = p.costo > 0 ? (((p.venta - p.costo) / p.costo) * 100).toFixed(0) : 0;
            
            tbodyP.innerHTML += `
                <tr class="${esBajo ? 'low-stock-row' : ''}">
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

    const diaEl = document.getElementById('stat-dia');
    const mesEl = document.getElementById('stat-mes');
    if(diaEl) diaEl.innerText = `$${(vDia - gDia).toLocaleString()}`;
    if(mesEl) mesEl.innerText = `$${(vMes - gMes).toLocaleString()}`;
    
    return { netoDia: vDia - gDia, netoMes: vMes - gMes };
}

// --- LÓGICA DE CALCULADORA ---
document.getElementById('calc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const costoTotal = parseFloat(document.getElementById('c-costo-total').value);
    const cantidad = parseFloat(document.getElementById('c-cantidad').value);
    const margen = parseFloat(document.getElementById('c-margen').value);

    if (costoTotal > 0 && cantidad > 0) {
        const costoUnitario = costoTotal / cantidad;
        const precioVenta = costoUnitario * (1 + (margen / 100));
        const gananciaTotal = (precioVenta * cantidad) - costoTotal;

        document.getElementById('res-precio-unitario').innerText = `$${Math.ceil(precioVenta).toLocaleString()}`;
        document.getElementById('res-ganancia').innerText = `$${Math.ceil(gananciaTotal).toLocaleString()}`;
        document.getElementById('calc-resultado').style.display = 'block';
    } else {
        alert("Ingresá valores válidos mayor a 0");
    }
});

// --- FORMULARIOS ---
document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
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
        document.getElementById('p-nombre').value = p.nombre;
        document.getElementById('p-stock').value = p.stock;
        document.getElementById('p-minimo').value = p.minimo;
        document.getElementById('p-costo').value = p.costo;
        document.getElementById('p-venta').value = p.venta;
        
        editandoId = id;
        document.getElementById('btn-save-prod').innerText = "Actualizar Producto";
        document.getElementById('btn-cancel-edit').style.display = "block";
        document.getElementById('prod-form').scrollIntoView({ behavior: 'smooth' });
    }
};

window.cancelarEdicion = () => {
    editandoId = null;
    document.getElementById('prod-form').reset();
    document.getElementById('btn-save-prod').innerText = "Guardar Producto";
    document.getElementById('btn-cancel-edit').style.display = "none";
};

document.getElementById('venta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pId = document.getElementById('v-producto').value;
    const p = productos.find(x => x.id === pId);
    const cant = parseInt(document.getElementById('v-cantidad').value);

    if (p && p.stock >= cant) {
        const t = new Date();
        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            idProd: pId, nombre: p.nombre, total: p.venta * cant, cantidad: cant,
            pago: document.getElementById('v-pago').value, fechaStr: t.toLocaleDateString(),
            mes: t.getMonth(), anio: t.getFullYear(), hora: t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            timestamp: Date.now()
        });
        await updateDoc(doc(db, `usuarios/${currentUser.uid}/productos`, pId), { stock: p.stock - cant });
        e.target.reset();
        document.getElementById('display-total').innerText = "Total: $0.00";
    } else { alert("Stock insuficiente"); }
});

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
    
    const titulos = { 'tab-productos': 'Inventario', 'tab-ventas': 'Ventas', 'tab-gastos': 'Gastos', 'tab-calculadora': 'Calculadora', 'tab-informes': 'Reportes' };
    const titleEl = document.getElementById('current-tab-title');
    if(titleEl) titleEl.innerText = titulos[id];

    document.querySelectorAll('.nav-item').forEach(btn => {
        if(btn.getAttribute('onclick').includes(id)) btn.classList.add('active');
    });
};

function actualizarSelectores() {
    const s = document.getElementById('v-producto');
    if(!s) return;
    const val = s.value;
    s.innerHTML = '<option value="">Seleccione...</option>';
    productos.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} (${p.stock})</option>`);
    s.value = val;
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

// --- PDF COMPLETO (DESGLOSE EFECTIVO/TRANSF) ---
window.descargarPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const b = actualizarDashboard();
    const t = new Date();
    const hoyStr = t.toLocaleDateString();

    const ventasHoy = ventas.filter(v => v.fechaStr === hoyStr);
    
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
    doc.text(`BALANCE NETO HOY: $${b.netoDia.toLocaleString()}`, 14, 42);
    
    doc.setFontSize(11);
    doc.setTextColor(50);
    doc.text(`• Efectivo en Caja: $${totalEfectivo.toLocaleString()}`, 14, 50);
    doc.text(`• Banco/Transf: $${totalTransf.toLocaleString()}`, 14, 56);
    
    doc.setFontSize(14);
    doc.setTextColor(7, 153, 146);
    doc.text(`ACUMULADO MES (Neto): $${b.netoMes.toLocaleString()}`, 14, 66);

    doc.autoTable({ 
        startY: 75, 
        head: [['Hora', 'Movimiento', 'Pago', 'Monto']], 
        headStyles: { fillColor: [30, 55, 153] },
        body: [ 
            ...ventasHoy.map(v => [v.hora, 'VENTA: ' + v.nombre, v.pago, '$' + v.total]), 
            ...gastos.filter(g => g.fechaStr === hoyStr).map(g => [g.hora, 'GASTO: ' + g.motivo, '-', '-$' + g.monto]) 
        ] 
    });
    doc.save(`Cierre_${hoyStr.replace(/\//g, '-')}.pdf`);
};