/**
 * resources/js/pages/encuestas/RegistroMasivo.jsx
 *
 * Registro de UNA misma entrega (cantidad + fecha) para varias familias a la
 * vez. En la práctica el camión de gas reparte por calle, no familia por
 * familia. Flujo: elegir sede y calle (o "todas las calles de la sede"), marcar
 * las familias que recibieron y registrar una sola vez. Solo admin.
 *
 * Origen: propuesta de la compañera que diseñó el módulo, adaptada (oct-2026):
 *  · Cantidad entre 1 y 99 y fecha no futura, validadas en el cliente igual
 *    que en el backend.
 *  · Si la encuesta está cerrada no se ofrece el formulario.
 *  · Las peticiones atrasadas se descartan (cambiar de calle rápido no deja
 *    pintada una lista vieja) y la lista de familias nunca falla si el
 *    backend no la trae.
 *  · Reutiliza el endpoint de detalle del mapa de calor
 *    (GET /v1/mapa-calor/calle/{calle}), que a un admin le devuelve cada
 *    familia con su estado actual (al día, próximo, vencido).
 *  · "Seleccionar solo atrasadas" marca las familias vencidas y próximas a
 *    vencer (solo aparece en encuestas de gas, que son las que predicen).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import apiClient    from '../../services/axios';
import ConfirmModal from '../../components/ui/ConfirmModal';
import './RegistroMasivo.css';

// Fecha de hoy en hora LOCAL (toISOString() daría la fecha UTC, que en
// Venezuela pasa a "mañana" después de las 8 p. m.)
const hoyLocal = () => {
    const d   = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
};

const formatearFecha = (f) => (f ? f.split('-').reverse().join('/') : '—');

const ESTADO_LABEL = {
    al_dia:    'Al día',
    proximo:   'Próximo',
    vencido:   'Vencido',
    sin_datos: 'Sin datos',
};

export default function RegistroMasivo({ encuestaId, cerrada = false, onSuccess }) {
    const [sedes,   setSedes]   = useState([]);
    const [sedeId,  setSedeId]  = useState('');
    const [calles,  setCalles]  = useState([]);
    const [calleId, setCalleId] = useState(''); // '' | 'todas' | id de calle

    const [familias,         setFamilias]         = useState([]);
    const [seleccionadas,    setSeleccionadas]    = useState(() => new Set());
    const [cargandoFamilias, setCargandoFamilias] = useState(false);

    const [cantidad,      setCantidad]      = useState('1');
    const [fechaEntrega,  setFechaEntrega]  = useState(hoyLocal);
    const [observaciones, setObservaciones] = useState('');

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isSaving,    setIsSaving]    = useState(false);
    const [mensaje,     setMensaje]     = useState(null);
    const [error,       setError]       = useState(null);

    const cargaReq = useRef(0);

    // ── Sedes ─────────────────────────────────────────────────
    useEffect(() => {
        let cancelado = false;

        apiClient.get('/v1/sedes')
            .then(({ data }) => { if (!cancelado) setSedes(data.data); })
            .catch(() => { if (!cancelado) setError('No se pudieron cargar las sedes.'); });

        return () => { cancelado = true; };
    }, []);

    // ── Calles de la sede elegida ─────────────────────────────
    useEffect(() => {
        setCalleId('');
        setFamilias([]);
        setSeleccionadas(new Set());

        if (!sedeId) {
            setCalles([]);
            return undefined;
        }

        let cancelado = false;

        apiClient.get(`/v1/sedes/${sedeId}/calles`)
            .then(({ data }) => { if (!cancelado) setCalles(data.data); })
            .catch(() => { if (!cancelado) setError('No se pudieron cargar las calles de esta sede.'); });

        return () => { cancelado = true; };
    }, [sedeId]);

    // ── Familias de la calle (o de todas las calles de la sede) ─
    const cargarFamilias = useCallback(async () => {
        const numero = ++cargaReq.current;

        if (!calleId) {
            setFamilias([]);
            setCargandoFamilias(false);
            return;
        }

        setCargandoFamilias(true);
        setError(null);

        try {
            const objetivo = calleId === 'todas'
                ? calles
                : calles.filter((c) => String(c.id) === String(calleId));

            const resultados = await Promise.all(
                objetivo.map((c) => apiClient
                    .get(`/v1/mapa-calor/calle/${c.id}`, { params: { encuesta_id: encuestaId } })
                    .then(({ data }) => (data.data.familias ?? []).map((f) => ({ ...f, calle: c.nombre })))),
            );

            if (numero !== cargaReq.current) return;
            setFamilias(resultados.flat());
        } catch (err) {
            if (numero !== cargaReq.current) return;
            setError(err.response?.data?.message ?? 'No se pudieron cargar las familias.');
            setFamilias([]);
        } finally {
            if (numero === cargaReq.current) setCargandoFamilias(false);
        }
    }, [calleId, calles, encuestaId]);

    useEffect(() => {
        setSeleccionadas(new Set());
        setMensaje(null);
        cargarFamilias();
    }, [cargarFamilias]);

    // ── Selección ─────────────────────────────────────────────
    const todasSeleccionadas = familias.length > 0 && seleccionadas.size === familias.length;
    const hayEstados         = familias.some((f) => f.estado);

    const toggleTodas = () => {
        setSeleccionadas(todasSeleccionadas ? new Set() : new Set(familias.map((f) => f.familia_id)));
    };

    const toggleUna = (id) => {
        setSeleccionadas((prev) => {
            const siguiente = new Set(prev);
            if (siguiente.has(id)) {
                siguiente.delete(id);
            } else {
                siguiente.add(id);
            }
            return siguiente;
        });
    };

    const seleccionarAtrasadas = () => {
        setSeleccionadas(new Set(
            familias
                .filter((f) => f.estado === 'vencido' || f.estado === 'proximo')
                .map((f) => f.familia_id),
        ));
    };

    // ── Validación del formulario ─────────────────────────────
    const errorForm = useMemo(() => {
        const cant = Number(cantidad);

        if (cantidad === '' || !Number.isInteger(cant) || cant < 1 || cant > 99) {
            return 'La cantidad debe ser un número entero entre 1 y 99.';
        }
        if (!fechaEntrega) return 'Indica la fecha de entrega.';
        if (fechaEntrega > hoyLocal()) return 'La fecha de entrega no puede ser futura.';

        return null;
    }, [cantidad, fechaEntrega]);

    // ── Envío ─────────────────────────────────────────────────
    const registrar = async () => {
        setIsSaving(true);
        setError(null);
        setMensaje(null);

        try {
            const { data } = await apiClient.post(`/v1/encuestas/${encuestaId}/respuestas/masivo`, {
                familia_ids:   Array.from(seleccionadas),
                cantidad:      Number(cantidad),
                fecha_entrega: fechaEntrega,
                observaciones: observaciones.trim() || null,
            });

            setMensaje(data.message);
            setSeleccionadas(new Set());
            setObservaciones('');
            setConfirmOpen(false);
            await cargarFamilias(); // refresca los estados: ahora deberían salir al día
            onSuccess?.();
        } catch (err) {
            setConfirmOpen(false);

            if (err.response?.status === 422) {
                const errores = err.response.data.errors ?? {};
                setError(Object.values(errores).flat()[0] ?? 'Los datos no son válidos.');
            } else {
                setError(err.response?.data?.message ?? 'No se pudo registrar la entrega masiva.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const cantidadSel = seleccionadas.size;

    if (cerrada) {
        return (
            <div className="regmasivo">
                <p className="regmasivo__aviso" role="status">
                    🔒 Esta encuesta está cerrada: no admite nuevas entregas. Puedes reabrirla
                    desde la lista de encuestas.
                </p>
            </div>
        );
    }

    return (
        <div className="regmasivo">
            <h2 className="regmasivo__titulo">Registrar entrega a varias familias</h2>
            <p className="regmasivo__ayuda">
                Elige la sede y la calle, marca las familias que recibieron y registra la entrega una sola vez.
            </p>

            {mensaje && <p className="regmasivo__mensaje" role="status">✓ {mensaje}</p>}
            {error && <p className="regmasivo__error" role="alert">{error}</p>}

            <div className="regmasivo__fila">
                <div className="regmasivo__campo">
                    <label htmlFor="rm-sede">Sede / consejo comunal</label>
                    <select id="rm-sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                        <option value="">Selecciona una sede…</option>
                        {sedes.map((s) => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="regmasivo__campo">
                    <label htmlFor="rm-calle">Calle / sector</label>
                    <select
                        id="rm-calle"
                        value={calleId}
                        onChange={(e) => setCalleId(e.target.value)}
                        disabled={!sedeId || calles.length === 0}
                    >
                        <option value="">Selecciona una calle…</option>
                        {calles.length > 1 && (
                            <option value="todas">★ Todas las calles de la sede</option>
                        )}
                        {calles.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            {cargandoFamilias && <p className="regmasivo__cargando">Cargando familias…</p>}

            {!cargandoFamilias && calleId && familias.length === 0 && (
                <p className="regmasivo__cargando">Esta selección no tiene familias registradas.</p>
            )}

            {!cargandoFamilias && familias.length > 0 && (
                <>
                    <div className="regmasivo__barra">
                        <label className="regmasivo__todas">
                            <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas} />
                            Seleccionar todas ({familias.length})
                        </label>

                        {hayEstados && (
                            <button type="button" className="regmasivo__atajo" onClick={seleccionarAtrasadas}>
                                Seleccionar solo atrasadas (vencidas y próximas)
                            </button>
                        )}

                        <span className="regmasivo__contador">
                            {cantidadSel} {cantidadSel === 1 ? 'seleccionada' : 'seleccionadas'}
                        </span>
                    </div>

                    <ul className="regmasivo__lista">
                        {familias.map((f) => (
                            <li key={f.familia_id}>
                                <label className={`regmasivo__item ${seleccionadas.has(f.familia_id) ? 'regmasivo__item--marcada' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={seleccionadas.has(f.familia_id)}
                                        onChange={() => toggleUna(f.familia_id)}
                                    />
                                    <span className="regmasivo__nombre">
                                        {f.responsable || `Familia #${f.familia_id}`}
                                        {f.codigo_vivienda && (
                                            <small className="regmasivo__calle"> · {f.codigo_vivienda}</small>
                                        )}
                                        {calleId === 'todas' && (
                                            <small className="regmasivo__calle"> · {f.calle}</small>
                                        )}
                                    </span>
                                    <span className="regmasivo__ultima">
                                        Última: {formatearFecha(f.ultima_entrega)}
                                    </span>
                                    {f.estado ? (
                                        <span className={`regmasivo__estado regmasivo__estado--${f.estado}`}>
                                            {ESTADO_LABEL[f.estado] ?? f.estado}
                                        </span>
                                    ) : (
                                        <span className={`regmasivo__estado ${f.recibio ? 'regmasivo__estado--al_dia' : 'regmasivo__estado--sin_datos'}`}>
                                            {f.recibio ? 'Ya recibió' : 'Sin entrega'}
                                        </span>
                                    )}
                                </label>
                            </li>
                        ))}
                    </ul>

                    <div className="regmasivo__fila">
                        <div className="regmasivo__campo">
                            <label htmlFor="rm-cantidad">Cantidad por familia</label>
                            <input
                                id="rm-cantidad"
                                type="number"
                                min={1}
                                max={99}
                                value={cantidad}
                                onChange={(e) => setCantidad(e.target.value)}
                            />
                        </div>

                        <div className="regmasivo__campo">
                            <label htmlFor="rm-fecha">Fecha de entrega</label>
                            <input
                                id="rm-fecha"
                                type="date"
                                value={fechaEntrega}
                                max={hoyLocal()}
                                onChange={(e) => setFechaEntrega(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="regmasivo__campo">
                        <label htmlFor="rm-obs">Observaciones (opcional)</label>
                        <textarea
                            id="rm-obs"
                            rows={2}
                            maxLength={500}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                        />
                    </div>

                    {errorForm && cantidadSel > 0 && (
                        <p className="regmasivo__error" role="alert">{errorForm}</p>
                    )}

                    <button
                        type="button"
                        className="regmasivo__enviar"
                        disabled={cantidadSel === 0 || errorForm !== null}
                        onClick={() => setConfirmOpen(true)}
                    >
                        Registrar entrega a {cantidadSel} {cantidadSel === 1 ? 'familia' : 'familias'}
                    </button>
                </>
            )}

            <ConfirmModal
                isOpen={confirmOpen}
                title="Registrar entrega masiva"
                message={`¿Registrar la entrega a ${cantidadSel} ${cantidadSel === 1 ? 'familia' : 'familias'}?`}
                detail={`${cantidad} unidad(es) por familia, con fecha ${formatearFecha(fechaEntrega)}. Las familias que ya tengan una entrega ese día se omiten.`}
                confirmLabel="Sí, registrar"
                variant="warning"
                onConfirm={registrar}
                onCancel={() => setConfirmOpen(false)}
                isLoading={isSaving}
            />
        </div>
    );
}
