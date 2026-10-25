/**
 * resources/js/pages/mapa-calor/EditarCoordenadasCalle.jsx
 *
 * Asignar el punto de una calle en el mapa (solo admin): se elige la sede,
 * la calle y se hace clic en el mapa. Guarda con
 * PATCH /v1/calles/{calle}/coordenadas.
 *
 * CORRECCIONES respecto a la versión original (oct-2026):
 *  · MapContainer ignora los cambios de su prop `center` después de montarse,
 *    así que al elegir otra sede el mapa no se movía. Ahora un componente
 *    interno (Vista) recentra con setView cuando cambia la sede o la calle.
 *  · /v1/sedes se pide con ?con_limites=1: el polígono de la sede solo viaja
 *    cuando hace falta (los selects de otros formularios no lo reciben).
 *  · Tras guardar se actualiza la calle en la lista local (sin otra petición)
 *    y se muestran los errores de validación del backend (rango de Miranda).
 *  · El pin se dibuja con una clase CSS (editcoord-pin), sin estilos en línea.
 *
 * Nota: usa CircleMarker y un divIcon, no el marcador por defecto de Leaflet
 * (se rompe con Vite al buscar sus imágenes en una ruta que no existe).
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, CircleMarker, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../../services/axios';
import '../familias/FamiliaList.css';
import './EditarCoordenadasCalle.css';

const CENTRO_DEFECTO = [10.342, -67.023];

const esCoordenada = (n) => typeof n === 'number' && Number.isFinite(n);

const poligonoValido = (limites) => Array.isArray(limites) && limites.length >= 3;

const promedio = (puntos) => [
    puntos.reduce((suma, p) => suma + p[0], 0) / puntos.length,
    puntos.reduce((suma, p) => suma + p[1], 0) / puntos.length,
];

const ESTILO_POLIGONO = {
    color: '#c0392b',
    weight: 2,
    fillColor: '#c0392b',
    fillOpacity: 0.05,
    dashArray: '6 4',
};

const ICONO_NUEVO_PUNTO = L.divIcon({
    html: '<span>📍</span>',
    className: 'editcoord-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

// Captura el clic en el mapa y lo devuelve como [lat, lng]
function CapturarClic({ onClick }) {
    useMapEvents({
        click(e) {
            onClick([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
}

// Recentra el mapa solo cuando cambia `clave` (sede o calle elegida)
function Vista({ centro, zoom, clave }) {
    const map = useMap();

    useEffect(() => {
        map.setView(centro, zoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, clave]);

    return null;
}

export default function EditarCoordenadasCalle() {
    const navigate = useNavigate();

    const [sedes,      setSedes]      = useState([]);
    const [sedeId,     setSedeId]     = useState('');
    const [calles,     setCalles]     = useState([]);
    const [calleId,    setCalleId]    = useState('');
    const [puntoNuevo, setPuntoNuevo] = useState(null);
    const [isSaving,   setIsSaving]   = useState(false);
    const [mensaje,    setMensaje]    = useState(null);
    const [error,      setError]      = useState(null);

    const sedeSeleccionada = useMemo(
        () => sedes.find((s) => String(s.id) === String(sedeId)) ?? null,
        [sedes, sedeId],
    );

    const calleSeleccionada = useMemo(
        () => calles.find((c) => String(c.id) === String(calleId)) ?? null,
        [calles, calleId],
    );

    const callesConCoordenada = useMemo(
        () => calles.filter((c) => esCoordenada(c.latitud) && esCoordenada(c.longitud)),
        [calles],
    );

    // ── Sedes (con su polígono, que solo este editor necesita) ──
    useEffect(() => {
        let cancelado = false;

        apiClient.get('/v1/sedes', { params: { con_limites: 1 } })
            .then(({ data }) => { if (!cancelado) setSedes(data.data); })
            .catch(() => { if (!cancelado) setError('No se pudieron cargar las sedes.'); });

        return () => { cancelado = true; };
    }, []);

    // ── Calles de la sede elegida ───────────────────────────────
    useEffect(() => {
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

    // ── Dónde centrar el mapa ───────────────────────────────────
    // Prioridad: la calle elegida (si ya tiene punto) → polígono de la sede →
    // calles con punto → centro por defecto.
    const encuadre = useMemo(() => {
        if (calleSeleccionada && esCoordenada(calleSeleccionada.latitud) && esCoordenada(calleSeleccionada.longitud)) {
            return { centro: [calleSeleccionada.latitud, calleSeleccionada.longitud], zoom: 17 };
        }

        if (poligonoValido(sedeSeleccionada?.limites)) {
            return { centro: promedio(sedeSeleccionada.limites.map(([lng, lat]) => [lat, lng])), zoom: 15 };
        }

        if (callesConCoordenada.length > 0) {
            return { centro: promedio(callesConCoordenada.map((c) => [c.latitud, c.longitud])), zoom: 15 };
        }

        return { centro: CENTRO_DEFECTO, zoom: 14 };
    }, [calleSeleccionada, sedeSeleccionada, callesConCoordenada]);

    const claveVista = `${sedeId}|${calleId}|${calles.length}`;

    const handleSede = (valor) => {
        setSedeId(valor);
        setCalleId('');
        setPuntoNuevo(null);
        setMensaje(null);
        setError(null);
    };

    const handleCalle = (valor) => {
        setCalleId(valor);
        setPuntoNuevo(null);
        setMensaje(null);
        setError(null);
    };

    const handleGuardar = async () => {
        if (!calleId || !puntoNuevo) {
            setError('Selecciona una calle y haz clic en el mapa para marcar su ubicación.');
            return;
        }

        setIsSaving(true);
        setError(null);
        setMensaje(null);

        try {
            const { data } = await apiClient.patch(`/v1/calles/${calleId}/coordenadas`, {
                latitud:  Number(puntoNuevo[0].toFixed(7)),
                longitud: Number(puntoNuevo[1].toFixed(7)),
            });

            // Actualiza la calle en la lista local sin volver a pedirla
            setCalles((prev) => prev.map((c) => (
                String(c.id) === String(calleId)
                    ? { ...c, latitud: data.data.latitud, longitud: data.data.longitud }
                    : c
            )));
            setPuntoNuevo(null);
            setMensaje('Coordenada guardada correctamente.');
        } catch (err) {
            const errores = err.response?.data?.errors;
            setError(
                errores?.latitud?.[0]
                ?? errores?.longitud?.[0]
                ?? err.response?.data?.message
                ?? 'No se pudo guardar la coordenada.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="list-page">

            <header className="list-topbar">
                <button type="button" className="list-topbar__back" onClick={() => navigate('/mapa-calor')}>
                    ← Mapa de calor
                </button>
                <div className="list-topbar__breadcrumb">
                    <span>SIGET</span><span>›</span><span>Mapa de calor</span><span>›</span><span>Coordenadas</span>
                </div>
            </header>

            <main className="list-container">

                <div className="list-heading">
                    <div>
                        <h1 className="list-heading__title">Asignar coordenadas de calles</h1>
                        <p className="list-heading__subtitle">
                            Elige una sede y una calle, y haz clic en el mapa donde queda esa calle o sector.
                        </p>
                        {calles.length > 0 && (
                            <span className="list-heading__count">
                                {callesConCoordenada.length} de {calles.length} con coordenada
                            </span>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="list-alert list-alert--error" role="alert">
                        <span>⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {mensaje && (
                    <div className="editcoord-exito" role="status">✓ {mensaje}</div>
                )}

                <div className="editcoord-controles">
                    <div className="editcoord-campo">
                        <label htmlFor="editcoord-sede">Sede / consejo comunal</label>
                        <select id="editcoord-sede" value={sedeId} onChange={(e) => handleSede(e.target.value)}>
                            <option value="">Selecciona una sede…</option>
                            {sedes.map((s) => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="editcoord-campo">
                        <label htmlFor="editcoord-calle">Calle / sector</label>
                        <select
                            id="editcoord-calle"
                            value={calleId}
                            onChange={(e) => handleCalle(e.target.value)}
                            disabled={!sedeId}
                        >
                            <option value="">Selecciona una calle…</option>
                            {calles.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}{esCoordenada(c.latitud) ? ' ✓' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        className="list-btn list-btn--primary"
                        onClick={handleGuardar}
                        disabled={!calleId || !puntoNuevo || isSaving}
                    >
                        {isSaving ? 'Guardando…' : 'Guardar coordenada'}
                    </button>
                </div>

                {puntoNuevo && (
                    <p className="editcoord-punto" role="status">
                        📍 Punto marcado: {puntoNuevo[0].toFixed(6)}, {puntoNuevo[1].toFixed(6)} — presiona
                        «Guardar coordenada» para confirmarlo.
                    </p>
                )}

                <MapContainer
                    center={CENTRO_DEFECTO}
                    zoom={14}
                    scrollWheelZoom
                    className="editcoord-mapa"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Vista centro={encuadre.centro} zoom={encuadre.zoom} clave={claveVista} />
                    <CapturarClic onClick={setPuntoNuevo} />

                    {poligonoValido(sedeSeleccionada?.limites) && (
                        <Polygon
                            positions={sedeSeleccionada.limites.map(([lng, lat]) => [lat, lng])}
                            pathOptions={ESTILO_POLIGONO}
                        />
                    )}

                    {/* Calles que YA tienen coordenada guardada */}
                    {callesConCoordenada.map((c) => {
                        const esLaElegida = String(c.id) === String(calleId);
                        const color = esLaElegida ? '#c9a84c' : '#639922';

                        return (
                            <CircleMarker
                                key={c.id}
                                center={[c.latitud, c.longitud]}
                                radius={esLaElegida ? 11 : 8}
                                pathOptions={{ color, fillColor: color, fillOpacity: 0.75 }}
                            >
                                <Popup>{c.nombre} (ya guardada)</Popup>
                            </CircleMarker>
                        );
                    })}

                    {/* Punto recién marcado, todavía sin guardar */}
                    {puntoNuevo && (
                        <Marker position={puntoNuevo} icon={ICONO_NUEVO_PUNTO}>
                            <Popup>Nueva ubicación (sin guardar)</Popup>
                        </Marker>
                    )}
                </MapContainer>

                <div className="editcoord-leyenda">
                    <span><i className="editcoord-leyenda__punto editcoord-leyenda__punto--guardada" aria-hidden="true" /> Calle con coordenada</span>
                    <span><i className="editcoord-leyenda__punto editcoord-leyenda__punto--elegida" aria-hidden="true" /> Calle elegida</span>
                    <span>📍 Punto nuevo sin guardar</span>
                </div>
            </main>
        </div>
    );
}
