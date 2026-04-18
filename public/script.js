function mostrarTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
    document.querySelectorAll('.formulario').forEach(f => f.classList.remove('activo'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab')[0].classList.add('activo');
        document.getElementById('form-login').classList.add('activo');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('activo');
        document.getElementById('form-registro').classList.add('activo');
    }
}

async function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('msg-login');
    
    try {
        const res = await fetch('/usuarios/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            msg.className = 'mensaje exito';
            msg.textContent = `✦ Bienvenido ${data.usuario.nombre}. Redirigiendo...`;
            setTimeout(() => window.location.href = '/', 1500);
        } else {
            msg.className = 'mensaje error';
            msg.textContent = '✦ ' + data.error;
        }
    } catch {
        msg.className = 'mensaje error';
        msg.textContent = '✦ Error de conexión.';
    }
}

async function registrarse() {
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const rol = document.getElementById('reg-rol').value;
    const msg = document.getElementById('msg-registro');
    
    try {
        const res = await fetch('/usuarios/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();
        
        if (res.ok) {
            msg.className = 'mensaje exito';
            msg.textContent = '✦ Cuenta creada. ¡Iniciá sesión!';
            setTimeout(() => mostrarTab('login'), 2000);
        } else {
            msg.className = 'mensaje error';
            msg.textContent = '✦ ' + data.error;
        }
    } catch {
        msg.className = 'mensaje error';
        msg.textContent = '✦ Error de conexión.';
    }
} 