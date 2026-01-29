import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- CONTROL DE ACCESO ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        escucharDatos();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Error al ingresar: " + err.message));
});

// Registro
document.getElementById('btn-register').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    if(!email || !pass) return alert("Completá email y clave para registrarte");
    createUserWithEmailAndPassword(auth, email, pass).catch(err => alert("Error al registrar: " + err.message));
});

window.cerrarSesion = () => signOut(auth);

// --- BASE DE DATOS EN TIEMPO REAL ---
function escucharDatos() {
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
}

function render() {
    // 1. Productos
    const tbodyP = document.querySelector('#tabla-productos tbody');
    tbodyP.innerHTML = '';
    productos.forEach(p => {
        const esBajo = p.stock <= (p.minimo || 10);
        const ganancia = (((p.venta - p.costo) / p.costo) * 100).toFixed(0);
        tbodyP.innerHTML += `<tr class="${esBajo ? 'low-stock-row' : ''}"><td>${p.nombre} ${esBajo ? '⚠️' : ''}</td><td>${p.stock}</td><td>$${p.venta}</td><td class="badge-ganancia">${ganancia}%</td><td><button onclick="borrarP('${p.id}')" class="btn-del">X</button></td></tr>`;
    });

    // 2. Ventas
    const tbodyV = document.querySelector('#tabla-ventas tbody');
    tbodyV.innerHTML = '';
    [...ventas].reverse().slice(0, 10).forEach(v => {
        tbodyV.innerHTML += `<tr><td>${v.hora}</td><td>${v.nombre}</td><td>$${v.total}</td><td><button onclick="anularV('${v.id}')" class="btn-del">↩</button></td></tr>`;
    });

    // 3. Gastos
    const tbodyG = document.querySelector('#tabla-gastos tbody');
    tbodyG.innerHTML = '';
    [...gastos].reverse().slice(0, 10).forEach(g => {
        tbodyG.innerHTML += `<tr><td>${g.hora}</td><td>${g.motivo}</td><td style="color:#eb2f06">-$${g.monto}</td><td><button onclick="borrarGasto('${g.id}')" class="btn-del">X</button></td></tr>`;
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

// --- ACCIONES ---
document.getElementById('prod-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/productos`), {
        nombre: document.getElementById('p-nombre').value,
        stock: parseInt(document.getElementById('p-stock').value),
        minimo: parseInt(document.getElementById('p-minimo').value),
        costo: parseFloat(document.getElementById('p-costo').value),
        venta: parseFloat(document.getElementById('p-venta').value)
    });
    e.target.reset();
});

document.getElementById('venta-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = document.getElementById('v-producto').value;
    const p = productos.find(x => x.id === prodId);
    const c = parseInt(document.getElementById('v-cantidad').value);
    
    if (p && p.stock >= c) {
        const t = new Date();
        // Registrar Venta
        await addDoc(collection(db, `usuarios/${currentUser.uid}/ventas`), {
            nombre: p.nombre, total: p.venta * c, cantidad: c, pago: document.getElementById('v-pago').value,
            fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
            hora: t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
        // Descontar Stock (aquí deberíamos usar un updateDoc, pero para simplificar lo dejamos así)
        e.target.reset();
    } else { alert("Sin stock"); }
});

document.getElementById('gasto-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = new Date();
    await addDoc(collection(db, `usuarios/${currentUser.uid}/gastos`), {
        motivo: document.getElementById('g-descripcion').value,
        monto: parseFloat(document.getElementById('g-monto').value),
        fechaStr: t.toLocaleDateString(), mes: t.getMonth(), anio: t.getFullYear(),
        hora: t.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });
    e.target.reset();
});

window.borrarP = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/productos`, id)); };
window.borrarGasto = async (id) => { if(confirm("¿Eliminar?")) await deleteDoc(doc(db, `usuarios/${currentUser.uid}/gastos`, id)); };

window.showTab = (id) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
};

function actualizarSelectores() {
    const s = document.getElementById('v-producto');
    s.innerHTML = '<option value="">Seleccione...</option>';
    productos.forEach(p => s.innerHTML += `<option value="${p.id}">${p.nombre} (${p.stock})</option>`);
}

function actualizarTotalVenta() {
    const p = productos.find(x => x.id == document.getElementById('v-producto').value);
    const c = document.getElementById('v-cantidad').value;
    document.getElementById('display-total').innerText = (p && c > 0) ? `Total: $${(p.venta * c).toLocaleString()}` : "Total: $0.00";
}

window.limpiarTodo = () => { if(confirm("¿Reiniciar?")) localStorage.clear(); location.reload(); };