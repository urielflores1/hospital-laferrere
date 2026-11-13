const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/medicos', async (req, res) => {
  try {
    const medicos = await prisma.medico.findMany({
      select: { dni: true, nombre: true, apellido: true, especialidad: true }
    });
    res.json(medicos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener médicos.' });
  }
});

// Validar clave institucional para registro de médicos
app.post('/medicos/validar-clave-registro', (req, res) => {
  const { clave } = req.body;
  
  // Acá definimos que la clave aceptada sea "1234"
  if (clave === '1234') {
    res.status(200).json({ message: 'Clave correcta' });
  } else {
    res.status(401).json({ error: 'Clave institucional incorrecta.' });
  }
});


app.post('/medicos/registro', async (req, res) => {
  try {
    const { dni, nombre, apellido, especialidad, password } = req.body;
    const existe = await prisma.medico.findUnique({ where: { dni } });
    if (existe) return res.status(400).json({ error: 'El médico ya está registrado.' });

    const nuevoMedico = await prisma.medico.create({
      data: { 
        dni, 
        nombre, 
        apellido, 
        especialidad, 
        password,
        duracionTurno: 30 // Agregamos el campo obligatorio con un valor por defecto
      }
    });
    res.status(201).json(nuevoMedico);
  } catch (error) {
    console.error("Error detallado:", error); // Esto te servirá para ver el error real en la consola
    res.status(500).json({ error: 'Error al registrar.' });
  }
});
app.post('/medicos/login', async (req, res) => {
  try {
    const { dni, password } = req.body;
    const medico = await prisma.medico.findUnique({ where: { dni } });
    
    if (medico && medico.password === password) {
      res.json({ message: 'Login exitoso', medico: { dni: medico.dni, apellido: medico.apellido } });
    } else {
      res.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

app.get('/medicos/:dni/turnos', async (req, res) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { dni: req.params.dni } });
    if (!medico) return res.status(404).json({ error: 'Médico no encontrado' });

    const turnos = await prisma.turno.findMany({
      where: { medicoId: medico.id },
      include: { paciente: true },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }]
    });
    res.json(turnos);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar turnos.' });
  }
});

app.get('/turnos/ocupados', async (req, res) => {
  try {
    const { medicoDni, fecha } = req.query;
    const medico = await prisma.medico.findUnique({ where: { dni: medicoDni } });
    if (!medico) return res.json([]);

    const turnos = await prisma.turno.findMany({
      where: { medicoId: medico.id, fecha: fecha, estado: 'PENDIENTE' }
    });
    res.json(turnos.map(t => t.hora));
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar horarios.' });
  }
});

app.post('/turnos', async (req, res) => {
  try {
    const { pacienteDni, nombre, apellido, celular, email, medicoDni, fecha, hora, motivo } = req.body;

    // 1. Buscar al médico por DNI
    const medico = await prisma.medico.findUnique({ where: { dni: medicoDni } });
    if (!medico) return res.status(404).json({ error: 'Médico no encontrado.' });

    // 2. Verificar disponibilidad del turno
    const ocupado = await prisma.turno.findFirst({
      where: { medicoDni: medico.dni, fecha, hora, estado: 'PENDIENTE' }
    });
    if (ocupado) return res.status(400).json({ error: 'El horario ya está ocupado.' });

    // 3. Buscar o crear al paciente por DNI
    let paciente = await prisma.paciente.findUnique({ where: { dni: pacienteDni } });
    if (!paciente) {
      paciente = await prisma.paciente.create({
        data: { 
          dni: pacienteDni, 
          nombre, 
          apellido, 
          telefono: celular, 
          email 
        }
      });
    }

    // 4. Crear el turno conectando ambas relaciones por su DNI (sin enviar pacienteDni ni id)
    const nuevoTurno = await prisma.turno.create({
      data: {
        fecha,
        hora,
        motivo: motivo || "",
        paciente: { connect: { dni: paciente.dni } },
        medico: { connect: { dni: medico.dni } }
      }
    });

    res.status(201).json(nuevoTurno);
  } catch (error) {
    console.error("Error DETALLADO al reservar turno:", error);
    res.status(500).json({ error: 'Error al reservar el turno.' });
  }
});

app.get('/turnos/paciente/:dni', async (req, res) => {
  try {
    const turnos = await prisma.turno.findMany({
      where: { pacienteDni: String(req.params.dni).trim() },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }]
    });
    res.json(turnos);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar los turnos.' });
  }
});

app.patch('/turnos/:id/estado', async (req, res) => {
  try {
    const turnoActualizado = await prisma.turno.update({
      where: { id: parseInt(req.params.id) },
      data: { estado: req.body.estado }
    });
    res.json(turnoActualizado);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));

module.exports = app;