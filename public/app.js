let medicoSesionDni = null;

document.addEventListener('DOMContentLoaded', () => {
  // Bloquear fechas pasadas en el calendario
  const inputFecha = document.getElementById('tFecha');
  if (inputFecha) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFecha.setAttribute('min', hoy);
    inputFecha.addEventListener('change', cargarHorariosDisponibles);
  }

  const selectMedico = document.getElementById('tMedico');
  if (selectMedico) selectMedico.addEventListener('change', cargarHorariosDisponibles);
});

function toggleBotonCarga(btnId, cargando, textoOriginal = 'Confirmar') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (cargando) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div> Procesando...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  }
}

function mostrarSeccion(idSeccion) {
  document.getElementById('pantallaInicio').style.display = 'none';
  document.querySelectorAll('.section-container').forEach(sec => sec.classList.remove('active-section'));
  document.getElementById(idSeccion).classList.add('active-section');
  if (idSeccion === 'seccionTurnos') cargarMedicosSelect();
}

function volverInicio() {
  document.querySelectorAll('.section-container').forEach(sec => sec.classList.remove('active-section'));
  document.getElementById('pantallaInicio').style.display = 'flex';
}

function cambiarTabMedico(tab) {
  document.getElementById('medicoLoginCard').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('medicoClaveCard').style.display = tab === 'registro' ? 'block' : 'none';
  document.getElementById('medicoRegistroCard').style.display = 'none';
  document.getElementById('btnTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('btnTabRegistro').classList.toggle('active', tab === 'registro');
}

function imprimirAgenda() {
  window.print();
}

// --- LÓGICA DE MÉDICOS: VALIDAR CLAVE INSTITUCIONAL ---
document.getElementById('formClaveMedico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const clave = document.getElementById('claveInstitucional').value;
  try {
    const res = await fetch('/medicos/validar-clave-registro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave })
    });
    if (res.ok) {
      document.getElementById('medicoClaveCard').style.display = 'none';
      document.getElementById('medicoRegistroCard').style.display = 'block';
    } else throw new Error();
  } catch {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Clave institucional incorrecta.' });
  }
});

// --- NUEVA LÓGICA DE MÉDICOS: REGISTRAR CUENTA ---
document.getElementById('formRegistroMedico').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const dni = document.getElementById('mDni').value;
  const nombre = document.getElementById('mNombre').value;
  const apellido = document.getElementById('mApellido').value;
  const especialidad = document.getElementById('mEspecialidad').value;
  const password = document.getElementById('mPassword').value;

  try {
    const res = await fetch('/medicos/registro', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ dni, nombre, apellido, especialidad, password })
    });
    
    if (res.ok) {
      Swal.fire({ icon: 'success', title: 'Cuenta Creada', text: 'El médico ha sido registrado. Ya puedes iniciar sesión.' });
      document.getElementById('formRegistroMedico').reset();
      cambiarTabMedico('login');
    } else {
      const err = await res.json();
      Swal.fire({ icon: 'error', title: 'Error', text: err.error || 'No se pudo registrar el médico.' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', text: 'Error de conexión con el servidor.' });
  }
});

// --- LÓGICA DE MÉDICOS: INICIAR SESIÓN ---
document.getElementById('formLoginMedico').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dni = document.getElementById('loginMedicoDni').value;
  const password = document.getElementById('loginMedicoPassword').value;

  try {
    const res = await fetch('/medicos/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dni, password })
    });
    if (res.ok) {
      const data = await res.json();
      medicoSesionDni = data.medico.dni;
      document.getElementById('bloqueAuthMedico').style.display = 'none';
      document.getElementById('panelMedico').style.display = 'block';
      document.getElementById('tituloMedico').innerText = `Dr. ${data.medico.apellido} - Agenda`;
      cargarTurnosMedico();
    } else throw new Error();
  } catch {
    Swal.fire({ icon: 'error', text: 'DNI o contraseña incorrectos.' });
  }
});

function cerrarSesionMedico() {
  medicoSesionDni = null;
  document.getElementById('panelMedico').style.display = 'none';
  document.getElementById('bloqueAuthMedico').style.display = 'block';
  document.getElementById('formLoginMedico').reset();
}

async function cargarTurnosMedico() {
  if (!medicoSesionDni) return;
  try {
    const res = await fetch(`/medicos/${medicoSesionDni}/turnos`);
    const turnos = await res.json();
    const tbody = document.getElementById('tablaTurnosMedico');
    tbody.innerHTML = '';

    turnos.forEach(t => {
      const pacNombre = t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}` : 'S/D';
      const pacDni = t.paciente ? t.paciente.dni : t.pacienteDni;
      const pacCelular = t.paciente && t.paciente.celular ? t.paciente.celular : '-';
      const btnEstado = t.estado === 'PENDIENTE' ? 
        `<button class="btn btn-small" onclick="cambiarEstadoTurno(${t.id}, 'ATENDIDO')">Marcar Atendido</button>` : 
        `<span style="color: grey;">Completado</span>`;

      tbody.innerHTML += `
        <tr>
          <td>${t.hora}</td>
          <td>${pacNombre}</td>
          <td>${pacDni}</td>
          <td>${pacCelular}</td>
          <td>${t.motivo || '-'}</td>
          <td><strong>${t.estado || 'PENDIENTE'}</strong></td>
          <td class="no-print">${btnEstado}</td>
        </tr>
      `;
    });
  } catch {}
}

async function cambiarEstadoTurno(id, nuevoEstado) {
  try {
    await fetch(`/turnos/${id}/estado`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado })
    });
    cargarTurnosMedico();
  } catch {}
}

// --- LÓGICA DE PACIENTES: CARGAR MÉDICOS ---
async function cargarMedicosSelect() {
  try {
    const res = await fetch('/medicos');
    if (!res.ok) return;
    const medicos = await res.json();
    const select = document.getElementById('tMedico');
    select.innerHTML = '<option value="">Seleccione un médico</option>';
    medicos.forEach(m => select.innerHTML += `<option value="${m.dni}">Dr. ${m.apellido} (${m.especialidad})</option>`);
  } catch (err) { console.log("Servidor no disponible"); }
}

async function cargarHorariosDisponibles() {
  const medicoDni = document.getElementById('tMedico')?.value;
  const fecha = document.getElementById('tFecha')?.value;
  const contenedor = document.getElementById('timeGrid');
  if (!contenedor || !medicoDni || !fecha) return;
  
  contenedor.innerHTML = '';
  document.getElementById('tHora').value = '';
  let ocupados = [];
  
  try {
    const res = await fetch(`/turnos/ocupados?medicoDni=${medicoDni}&fecha=${fecha}`);
    if (res.ok) ocupados = await res.json();
  } catch {}

  for (let mins = 8 * 60; mins < 18 * 60; mins += 40) {
    const horaTexto = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = horaTexto;
    btn.className = 'time-slot-btn';
    
    if (ocupados.includes(horaTexto)) {
      btn.style.backgroundColor = '#dc3545'; btn.style.color = 'white'; btn.disabled = true;
    } else {
      btn.onclick = () => {
        document.querySelectorAll('#timeGrid button:not(:disabled)').forEach(b => { b.style.backgroundColor = ''; b.style.color = ''; });
        btn.style.backgroundColor = '#28a745'; btn.style.color = 'white';
        document.getElementById('tHora').value = horaTexto;
      };
    }
    contenedor.appendChild(btn);
  }
}

// --- LÓGICA DE PACIENTES: RESERVAR TURNO ---
document.getElementById('formTurno').addEventListener('submit', async (e) => {
  e.preventDefault();
  const hora = document.getElementById('tHora').value;
  if (!hora) return Swal.fire({ icon: 'warning', text: 'Seleccione un horario.' });

  toggleBotonCarga('btnConfirmarTurno', true);
  
  const datosReserva = {
    pacienteDni: document.getElementById('pDni').value,
    nombre: document.getElementById('pNombre').value,
    apellido: document.getElementById('pApellido').value,
    celular: document.getElementById('pCelular').value,
    email: document.getElementById('pEmail').value, // AQUÍ ESTÁ EL GMAIL INTEGRADO
    medicoDni: document.getElementById('tMedico').value,
    fecha: document.getElementById('tFecha').value,
    hora: hora,
    motivo: document.getElementById('tMotivo').value
  };

  try {
    const res = await fetch('/turnos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosReserva)
    });
    if (res.ok) {
      Swal.fire({ icon: 'success', title: '¡Listo!', text: 'Turno reservado exitosamente.' }).then(() => {
        volverInicio();
        document.getElementById('formTurno').reset();
        document.getElementById('timeGrid').innerHTML = '';
      });
    } else {
      const err = await res.json();
      Swal.fire({ icon: 'error', text: err.error || 'Error al reservar.' });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', text: 'Error de conexión.' });
  } finally {
    toggleBotonCarga('btnConfirmarTurno', false, 'Confirmar Cita');
  }
});

// --- LÓGICA DE PACIENTES: BUSCAR MIS TURNOS ---
document.getElementById('formBuscarTurnos').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dni = document.getElementById('buscarDniPaciente').value;
  const btn = document.getElementById('btnBuscarTurnos');
  btn.disabled = true; btn.innerText = 'Buscando...';

  try {
    const res = await fetch(`/turnos/paciente/${dni}`);
    if (!res.ok) throw new Error();
    const turnos = await res.json();
    
    const tbody = document.getElementById('tablaMisTurnosBody');
    tbody.innerHTML = '';
    
    if (turnos.length === 0) {
      Swal.fire({ icon: 'info', text: 'No tienes turnos pendientes.' });
    } else {
      document.getElementById('resultadoTurnosPaciente').style.display = 'block';
      turnos.forEach(t => {
        const esCancelable = t.estado === 'PENDIENTE';
        tbody.innerHTML += `
          <tr>
            <td>${t.fecha} ${t.hora}</td>
            <td>Dr/a.</td>
            <td>${t.estado}</td>
            <td>
              ${esCancelable ? `<button class="btn btn-small" style="background-color: #dc3545;" onclick="cancelarTurnoPaciente(${t.id}, '${dni}')">Cancelar</button>` : '-'}
            </td>
          </tr>
        `;
      });
    }
  } catch (err) {
    Swal.fire({ icon: 'error', text: 'No se encontraron turnos o hubo un error.' });
  } finally {
    btn.disabled = false; btn.innerText = 'Buscar Turnos';
  }
});

async function cancelarTurnoPaciente(idTurno, dniPaciente) {
  const result = await Swal.fire({
    title: '¿Cancelar turno?', text: "Esta acción no se puede deshacer.",
    icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545',
    confirmButtonText: 'Sí, cancelar', cancelButtonText: 'Volver'
  });

  if (result.isConfirmed) {
    try {
      await fetch(`/turnos/${idTurno}/estado`, { 
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'CANCELADO' })
      });
      Swal.fire('Cancelado', 'El turno ha sido cancelado.', 'success');
      document.getElementById('btnBuscarTurnos').click(); 
    } catch {
      Swal.fire('Error', 'No se pudo cancelar el turno.', 'error');
    }
  }
}