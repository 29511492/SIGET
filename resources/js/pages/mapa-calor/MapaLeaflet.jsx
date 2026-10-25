/**
 * resources/js/pages/mapa-calor/MapaLeaflet.jsx
 *
 * Mapa real (Leaflet + OpenStreetMap) del mapa de calor territorial.
 *
 * CORRECCIONES respecto a la versión original (oct-2026):
 *  · AjustarVista usaba useMemo para un efecto secundario y, como recibía
 *    un array nuevo en cada render, el mapa volvía a ajustar el zoom cada
 *    vez que el padre se actualizaba (por ejemplo al hacer clic en una
 *    calle). Ahora usa useEffect con datos memoizados: el zoom y la
 *    posición del usuario se respetan.
 *  · El color de cada calle viene del padre (colorDe), con un estado gris
 *    para "sin datos": verde significa "al día", no "no se sabe".
 *  · Sin estilos en línea: la leyenda y el aviso se estilizan por clases.
 *  · Los polígonos de las sedes (limites) son opcionales; si una sede no
 *    tiene polígono trazado simplemente no se dibuja.
 *  · El mapa queda ENCUADRADO en la zona: se limita el desplazamiento al
 *    área del territorio (con un margen) y el zoom hacia afuera, para que
 *    solo se vea el recuadro donde está la comuna y no el mapa del mundo.
 *
 * Nota: usa solo CircleMarker (no el marcador por defecto de Leaflet, que
 * se rompe con Vite al buscar sus imágenes en una ruta que no existe).
 */

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaLeaflet.css';

// Centro por defecto: comuna Ana Karina Rote, Guacaipuro, Miranda
const CENTRO_DEFECTO = [10.342, -67.023];

const ESTILO_POLIGONO = {
    color: '#c0392b',
    weight: 2,
    fillColor: '#c0392b',
    fillOpacity: 0.08,
    dashArray: '6 4',
};

const esCoordenada = (n) => typeof n === 'number' && Number.isFinite(n);

const poligonoValido = (limites) => Array.isArray(limites) && limites.length >= 3;

// Margen alrededor de la zona dentro del cual se puede desplazar el mapa
// (0.35 = 35 % del tamaño de la zona hacia cada lado)
const MARGEN_ZONA = 0.35;

/**
 * Encuadra el mapa en la zona y limita el desplazamiento a ella. Solo se
 * ejecuta cuando cambian los puntos a mostrar (nuevo mapa), no en cada render
 * del padre: así respeta el zoom y la posición que el usuario haya elegido.
 */
function AjustarVista({ puntos }) {
    const map = useMap();

    useEffect(() => {
        if (puntos.length === 0) {
            // Sin puntos no hay zona que encuadrar: se quitan los límites
            map.setMaxBounds(null);
            map.setMinZoom(0);
            return;
        }

        let zona;

        if (puntos.length === 1) {
            // Una sola calle con coordenada: se arma una caja pequeña a su alrededor
            const [lat, lng] = puntos[0];
            zona = L.latLngBounds([lat - 0.004, lng - 0.004], [lat + 0.004, lng + 0.004]);
        } else {
            zona = L.latLngBounds(puntos);
        }

        // animate:false para que getZoom() ya devuelva el zoom final
        map.fitBounds(zona, { padding: [30, 30], maxZoom: 17, animate: false });
        map.setMaxBounds(zona.pad(MARGEN_ZONA));
        map.setMinZoom(Math.max(map.getZoom() - 1, 3));
    }, [map, puntos]);

    return null;
}

export default function MapaLeaflet({ calles, sedes, colorDe, etiquetaDe, onCalleClick, puedeAsignar }) {
    const callesConCoordenadas = useMemo(
        () => calles.filter((c) => esCoordenada(c.latitud) && esCoordenada(c.longitud)),
        [calles],
    );

    const callesSinCoordenadas = useMemo(
        () => calles.filter((c) => !esCoordenada(c.latitud) || !esCoordenada(c.longitud)),
        [calles],
    );

    // Los límites llegan como [lng, lat]; Leaflet espera [lat, lng]
    const poligonos = useMemo(
        () => (sedes ?? [])
            .filter((s) => poligonoValido(s.limites))
            .map((s) => ({
                id:         s.id,
                nombre:     s.nombre,
                posiciones: s.limites.map(([lng, lat]) => [lat, lng]),
            })),
        [sedes],
    );

    // Si hay polígonos se encuadran ellos; si no, los puntos de las calles
    const puntos = useMemo(
        () => (poligonos.length > 0
            ? poligonos.flatMap((p) => p.posiciones)
            : callesConCoordenadas.map((c) => [c.latitud, c.longitud])),
        [poligonos, callesConCoordenadas],
    );

    return (
        <div className="mapaleaflet">
            <MapContainer
                center={CENTRO_DEFECTO}
                zoom={15}
                scrollWheelZoom
                maxBoundsViscosity={1.0}
                className="mapaleaflet__mapa"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <AjustarVista puntos={puntos} />

                {poligonos.map((p) => (
                    <Polygon key={p.id} positions={p.posiciones} pathOptions={ESTILO_POLIGONO}>
                        <Popup>{p.nombre}</Popup>
                    </Polygon>
                ))}

                {callesConCoordenadas.map((c) => {
                    const color = colorDe(c.riesgo);

                    return (
                        <CircleMarker
                            key={c.calle_id}
                            center={[c.latitud, c.longitud]}
                            radius={12}
                            pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
                            eventHandlers={{ click: () => onCalleClick(c) }}
                        >
                            <Popup>
                                <strong>{c.calle}</strong><br />
                                {c.sede}<br />
                                {c.total_familias} {c.total_familias === 1 ? 'familia' : 'familias'}<br />
                                {etiquetaDe(c.riesgo)}
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>

            {callesSinCoordenadas.length > 0 && (
                <div className="mapaleaflet__aviso" role="status">
                    <p>
                        ⚠️ {callesSinCoordenadas.length}{' '}
                        {callesSinCoordenadas.length === 1 ? 'calle todavía no tiene' : 'calles todavía no tienen'}{' '}
                        coordenada y no {callesSinCoordenadas.length === 1 ? 'aparece' : 'aparecen'} en el mapa.
                        Siguen disponibles en la vista de tarjetas.
                    </p>
                    <p className="mapaleaflet__aviso-lista">
                        {callesSinCoordenadas.map((c) => c.calle).join(' · ')}
                    </p>
                    {puedeAsignar ? (
                        <Link to="/mapa-calor/coordenadas" className="mapaleaflet__aviso-link">
                            📍 Asignar coordenadas
                        </Link>
                    ) : (
                        <p>Pide al administrador que las asigne.</p>
                    )}
                </div>
            )}
        </div>
    );
}
