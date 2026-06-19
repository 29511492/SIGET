/**
 * resources/js/components/noticias/NoticiaWidget.jsx
 *
 * Widget compacto de últimas noticias para incrustar en
 * MiComunidad.jsx y PerfilPage.jsx sin saturar esas vistas.
 *
 * Muestra máximo 3 noticias publicadas con:
 *   - Título truncado
 *   - Extracto de 150 caracteres
 *   - Fecha relativa (ej: "hace 2 días")
 *
 * Consume:
 *   GET /api/v1/noticias/recientes → 3 noticias publicadas con caché 5min
 *
 * No tiene paginación — es un widget de vista previa.
 * Si el usuario quiere ver más, usa el enlace "Ver todas".
 */

import { useState, useEffect } from 'react';
import apiClient               from '../../services/axios';
import './NoticiaWidget.css';

export default function NoticiaWidget() {
    const [noticias,  setNoticias]  = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error,     setError]     = useState('');

    useEffect(() => {
        apiClient.get('/v1/noticias/recientes')
            .then(({ data }) => setNoticias(data.data))
            .catch(() => setError('No se pudieron cargar las noticias.'))
            .finally(() => setIsLoading(false));
    }, []);

    // ── Sin noticias ni error → no renderizar nada ────────────
    // Evita mostrar una sección vacía que sature la vista.
    if (!isLoading && !error && noticias.length === 0) {
        return null;
    }

    return (
        <section className="nw-section" aria-label="Últimas noticias">

            <div className="nw-header">
                <h2 className="nw-header__title">
                    <span className="nw-header__icon" aria-hidden="true">📰</span>
                    Últimas Noticias
                </h2>
            </div>

            {isLoading && (
                <div className="nw-list">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="nw-item nw-item--skeleton">
                            <div className="nw-item__skeleton-title" />
                            <div className="nw-item__skeleton-text" />
                            <div className="nw-item__skeleton-meta" />
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <p className="nw-error">{error}</p>
            )}

            {!isLoading && !error && (
                <div className="nw-list">
                    {noticias.map(noticia => (
                        <article key={noticia.id} className="nw-item">
                            <h3 className="nw-item__titulo">{noticia.titulo}</h3>
                            <p className="nw-item__extracto">{noticia.extracto}</p>
                            <p className="nw-item__meta">
                                <span className="nw-item__autor">
                                    {noticia.autor?.name ?? 'Consejo Comunal'}
                                </span>
                                <span className="nw-item__sep" aria-hidden="true">·</span>
                                <time className="nw-item__fecha">
                                    {noticia.fecha_legible}
                                </time>
                            </p>
                        </article>
                    ))}
                </div>
            )}

        </section>
    );
}
