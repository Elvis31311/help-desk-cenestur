import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Ticket {
  _id?: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  categoria: string;
  respuesta_ia: string;
  fecha?: string;
}

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cargando, setCargando] = useState(false);
  const [filtroPrioridad, setFiltroPrioridad] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [modoOscuro, setModoOscuro] = useState(false);

  const obtenerTickets = async () => {
    try {
      const res = await fetch('http://localhost:5000/tickets');
      const data = await res.json();
      if (Array.isArray(data)) setTickets(data);
    } catch (error) {
      console.error("Error al conectar con el backend local:", error);
    }
  };

  useEffect(() => {
    obtenerTickets();
  }, []);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descripcion) return alert('Por favor, llena todos los campos.');

    setCargando(true);
    try {
      const res = await fetch('http://localhost:5000/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descripcion }),
      });
      
      if (!res.ok) throw new Error('Error en el servidor');

      const nuevoTicket = await res.json();
      setTickets([nuevoTicket, ...tickets]);
      setTitulo('');
      setDescripcion('');
    } catch (error) {
      alert('Error al procesar el ticket con la IA.');
    } finally {
      setCargando(false);
    }
  };

  const ticketsFiltrados = tickets.filter(t => {
    const coincidePrioridad = filtroPrioridad === 'Todas' || t.prioridad === filtroPrioridad;
    const coincideCategoria = filtroCategoria === 'Todas' || t.categoria === filtroCategoria;
    return coincidePrioridad && coincideCategoria;
  });

  // Lógica para contar datos para los gráficos
  const datosPrioridad = useMemo(() => {
    const conteo = { Alta: 0, Media: 0, Baja: 0 };
    tickets.forEach(t => {
      if (t.prioridad === 'Urgente' || t.prioridad === 'Alta') conteo.Alta++;
      else if (t.prioridad === 'Media') conteo.Media++;
      else conteo.Baja++;
    });
    return [
      { name: 'Alta', value: conteo.Alta, color: '#ef4444' }, // red-500
      { name: 'Media', value: conteo.Media, color: '#f59e0b' }, // amber-500
      { name: 'Baja', value: conteo.Baja, color: '#10b981' }  // emerald-500
    ];
  }, [tickets]);

  const datosCategoria = useMemo(() => {
    const conteo: Record<string, number> = {};
    tickets.forEach(t => {
      conteo[t.categoria] = (conteo[t.categoria] || 0) + 1;
    });
    return Object.keys(conteo).map(key => ({
      name: key,
      cantidad: conteo[key]
    }));
  }, [tickets]);

  const tema = {
    fondoPrincipal: modoOscuro ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800",
    header: modoOscuro ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
    tituloTexto: modoOscuro ? "text-white" : "text-slate-900",
    subTituloTexto: modoOscuro ? "text-slate-300" : "text-slate-700",
    tarjeta: modoOscuro ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
    input: modoOscuro ? "bg-slate-900 border-slate-600 text-white placeholder-slate-500" : "bg-slate-50 border-slate-300 text-slate-900",
    tarjetaTicket: modoOscuro ? "bg-slate-800 border-slate-700 hover:border-indigo-500/50 shadow-md" : "bg-white border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-md",
    descripcionTicket: modoOscuro ? "bg-slate-900/50 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-700",
    cajaIA: modoOscuro ? "bg-indigo-950/40 border-indigo-500/30" : "bg-blue-50 border-blue-100",
    textoIA: modoOscuro ? "text-indigo-200" : "text-blue-900",
    tituloIA: modoOscuro ? "text-indigo-400" : "text-indigo-900",
    vacioBg: modoOscuro ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-500",
    graficoTexto: modoOscuro ? "#cbd5e1" : "#475569", // slate-300 vs slate-600
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${tema.fondoPrincipal}`}>
      
      <header className={`border-b sticky top-0 z-20 shadow-sm transition-colors duration-300 ${tema.header}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <h1 className={`text-2xl font-extrabold tracking-tight ${tema.tituloTexto}`}>
              Help Desk <span className="text-indigo-500">Inteligente</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setModoOscuro(!modoOscuro)}
              className={`p-2 rounded-full border transition-all duration-300 ${modoOscuro ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-slate-100 border-slate-300 hover:bg-slate-200'}`}
              title={modoOscuro ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              {modoOscuro ? '☀️' : '🌙'}
            </button>
            <div className="flex flex-col items-center md:items-end">
              <p className={`text-sm font-bold ${tema.subTituloTexto}`}>
                Cloud Computing <span className="text-indigo-500 mx-1">•</span> Elvis Sanchez
              </p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                Instituto Superior Tecnológico Cenestur
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <section className="lg:col-span-4 h-fit">
          <div className={`p-6 rounded-xl border transition-colors duration-300 ${tema.tarjeta}`}>
            <h2 className={`text-lg font-bold mb-5 border-b pb-3 ${tema.tituloTexto} ${modoOscuro ? 'border-slate-700' : 'border-slate-100'}`}>
              Nuevo Reporte
            </h2>
            <form onSubmit={manejarEnvio} className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${tema.subTituloTexto}`}>Asunto o Incidencia</label>
                <input 
                  type="text" 
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: Falla en el sistema de pagos..." 
                  className={`w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm ${tema.input}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${tema.subTituloTexto}`}>Descripción Detallada</label>
                <textarea 
                  rows={5}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe el impacto y los detalles técnicos..." 
                  className={`w-full border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm resize-none ${tema.input}`}
                />
              </div>
              <button 
                type="submit" 
                disabled={cargando}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm flex justify-center items-center gap-2"
              >
                {cargando ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analizando con IA...
                  </>
                ) : 'Generar Ticket'}
              </button>
            </form>
          </div>
        </section>

        <section className="lg:col-span-8 space-y-5">
          
          {/* CORREGIDO: Dashboard de Gráficos con espaciado mejorado */}
          {tickets.length > 0 && (
            <div className={`p-6 rounded-xl border flex flex-col md:flex-row gap-12 transition-colors duration-300 ${tema.tarjeta}`}>
              <div className="flex-1 min-w-0 h-64">
                <h3 className={`text-sm font-bold mb-2 text-center ${tema.subTituloTexto}`}>Métricas de Prioridad</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosPrioridad} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} stroke={modoOscuro ? "#1e293b" : "#ffffff"} paddingAngle={3}>
                      {datosPrioridad.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: modoOscuro ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px', color: modoOscuro ? '#fff' : '#000' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: tema.graficoTexto, paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="flex-1 min-w-0 h-64 border-t md:border-t-0 md:border-l p-6 md:p-0 md:pl-10 border-slate-200 dark:border-slate-700">
                <h3 className={`text-sm font-bold mb-2 text-center ${tema.subTituloTexto}`}>Tickets por Categoría</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosCategoria} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: tema.graficoTexto }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tema.graficoTexto }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: modoOscuro ? '#334155' : '#f1f5f9' }} contentStyle={{ backgroundColor: modoOscuro ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors duration-300 ${tema.tarjeta}`}>
            <h2 className={`text-lg font-bold ${tema.tituloTexto}`}>Bandeja de Entrada</h2>
            
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 transition-colors ${modoOscuro ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prioridad</span>
                <select 
                  value={filtroPrioridad} 
                  onChange={(e) => setFiltroPrioridad(e.target.value)}
                  className={`bg-transparent text-sm font-medium focus:outline-none cursor-pointer ${tema.tituloTexto}`}
                >
                  <option value="Todas" className="text-slate-900">Todas</option>
                  <option value="Alta" className="text-slate-900">🚨 Alta</option>
                  <option value="Media" className="text-slate-900">⚠️ Media</option>
                  <option value="Baja" className="text-slate-900">✅ Baja</option>
                </select>
              </div>

              <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 transition-colors ${modoOscuro ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</span>
                <select 
                  value={filtroCategoria} 
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className={`bg-transparent text-sm font-medium focus:outline-none cursor-pointer ${tema.tituloTexto}`}
                >
                  <option value="Todas" className="text-slate-900">Todas</option>
                  <option value="Hardware" className="text-slate-900">Hardware</option>
                  <option value="Software" className="text-slate-900">Software</option>
                  <option value="Redes" className="text-slate-900">Redes</option>
                  <option value="Accesos" className="text-slate-900">Accesos</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {ticketsFiltrados.length === 0 ? (
              <div className={`p-12 rounded-xl border text-center flex flex-col items-center justify-center transition-colors duration-300 ${tema.vacioBg}`}>
                <span className="text-5xl mb-4">📭</span>
                <h3 className={`text-lg font-bold ${tema.tituloTexto}`}>No hay tickets registrados</h3>
                <p className="mt-1">Ajusta los filtros o crea un nuevo reporte para comenzar.</p>
              </div>
            ) : (
              ticketsFiltrados.map((t, idx) => (
                <div key={t._id || idx} className={`p-6 rounded-xl border transition-all duration-300 ${tema.tarjetaTicket}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <h3 className={`text-lg font-bold leading-tight ${tema.tituloTexto}`}>{t.titulo}</h3>
                    <div className="flex gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${
                        t.prioridad === 'Urgente' || t.prioridad === 'Alta' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                        t.prioridad === 'Media' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                      }`}>
                        {t.prioridad === 'Alta' ? '🚨' : t.prioridad === 'Media' ? '⚠️' : '✅'} {t.prioridad}
                      </span>
                      <span className="bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                        📁 {t.categoria}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`border p-4 rounded-lg mb-4 ${tema.descripcionTicket}`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.descripcion}</p>
                  </div>
                  
                  {t.respuesta_ia && (
                    <div className={`border p-4 rounded-lg relative overflow-hidden ${tema.cajaIA}`}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                      <h4 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${tema.tituloIA}`}>
                        <span>✨</span> Diagnóstico & Resolución (IA)
                      </h4>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${tema.textoIA}`}>{t.respuesta_ia}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}