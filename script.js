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

// --- GESTIÓN DE USUARIO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        // Cambiamos a 'flex' para que la barra lateral de PC funcione bien
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-display').innerText = user.email;
        vincularBaseDeDatos();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

// Login y Registro
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: " + err.message));
});

document.getElementById('btn-register').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if (pass.length < 6) return alert("La clave debe tener 6 caracteres.");
    createUserWithEmailAndPassword(auth, email, pass).catch(err => alert("Error: " + err.message));
});

window.cerrarSesion = () => signOut(auth);

// --- SINCRONIZACIÓN ---
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
    // 1. Productos
    const tbodyP = document.querySelector('#tabla-productos tbody');
    if(tbodyP) {
        tbodyP.innerHTML = '';
        productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const esBajo = p.stock <= (p.minimo || 10);
            const ganancia = (((p.venta - p.costo) / p.costo) * 100).toFixed(0);
            tbodyP.innerHTML += `
                <tr class="${esBajo ? 'low-stock-row' : ''}">
                    <td>${p.nombre} ${esBajo ? '⚠️' : ''}</td>
                    <td>${p.stock}</td>
                    <td>$${p.venta}</td>
                    <td class="badge-ganancia">${ganancia}%</td>
                    <td><button onclick="borrarP('${p.id}')" class="btn-del">X</button></td>
                </tr>`;
        });
    }

    // 2. Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    if(tbodyV) {
        tbodyV.innerHTML = '';
        [...ventas].sort((a,b) => b.timestamp - a.timestamp).slice(0, 15).forEach(v => {
            tbodyV.innerHTML += `<tr><td>${v.hora}</td><td>${v.nombre}</td><td>$${v.total}</td><td><button onclick="anularV('${v.id}', '${v.idProd}', ${v.cantidad})" class="btn-del">↩</button></td></tr>`;
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

// --- FORMULARIOS ---
document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/productos`), {
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value) || 0,
        minimo: parseInt(document.getElementById('p-minimo').value) || 0,
        costo: parseFloat(document.getElementById('p-costo').value) || 0,
        venta: parseFloat(document.getElementById('p-venta').value) || 0
    });
    e.target.reset();
});

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
        const pRef = doc(db, `usuarios/${currentUser.uid}/productos`, pId);
        await updateDoc(pRef, { stock: p.stock - cant });
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

// --- FUNCIONES GLOBALES ---
window.borrarP = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/productos`, id)); };
window.borrarGasto = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/gastos`, id)); };
window.anularV = async (idVenta, idProd, cant) => {
    if(confirm("¿Anular venta?")) {
        await deleteDoc(doc(db, `usuarios/${currentUser.uid}/ventas`, idVenta));
        const p = productos.find(x => x.id === idProd);
        if(p) {
            const pRef = doc(db, `usuarios/${currentUser.uid}/productos`, idProd);
            await updateDoc(pRef, { stock: p.stock + cant });
        }
    }
};

window.showTab = (id) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    // Actualizar títulos
    const titulos = { 'tab-productos': 'Inventario', 'tab-ventas': 'Punto de Venta', 'tab-gastos': 'Gastos', 'tab-informes': 'Reportes' };
    document.getElementById('current-tab-title').innerText = titulos[id];

    // Marcar botón activo
    const buttons = document.querySelectorAll('.nav-item');
    buttons.forEach(btn => {
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

window.actualizarTotalVenta = () => {
    const p = productos.find(x => x.id == document.getElementById('v-producto').value);
    const c = document.getElementById('v-cantidad').value;
    const totalEl = document.getElementById('display-total');
    if(totalEl) totalEl.innerText = (p && c > 0) ? `Total: $${(p.venta * c).toLocaleString()}` : "Total: $0.00";
};

window.descargarPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const b = actualizarDashboard();
    doc.text("GestionYa PRO - Cierre de Caja", 14, 20);
    doc.text(`Balance Neto Hoy: $${b.netoDia}`, 14, 30);
    doc.autoTable({ startY: 40, head: [['Hora', 'Tipo', 'Monto']], 
        body: [ ...ventas.map(v => [v.hora, 'Venta: '+v.nombre, '$'+v.total]), ...gastos.map(g => [g.hora, 'GASTO: '+g.motivo, '-$'+g.monto]) ] 
    });
    doc.save("Cierre_Caja.pdf");
};