/**
 * resources/js/components/Dashboard/components/StatCard.jsx
 *
 * DECISIÓN: Componente atómico reutilizable.
 * Extraído de AdminDashboard para cumplir el principio DRY.
 * Si en el futuro OperadorDashboard también necesita stats,
 * importa este componente sin duplicar código.
 *
 * ANIMACIÓN DE CONTEO:
 * Usa requestAnimationFrame para animar el número desde 0
 * hasta el valor real al montar el componente. Efecto "contador"
 * que da vida a los datos del censo sin librerías externas.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @param {object}  props
 * @param {string}  props.label      - Etiqueta de la tarjeta
 * @param {number}  props.value      - Valor numérico a mostrar
 * @param {string}  props.icon       - Emoji o carácter SVG del ícono
 * @param {string}  props.color      - Clase Tailwind de color de acento
 * @param {string}  [props.trend]    - Texto de tendencia (ej: "+12 este mes")
 * @param {boolean} [props.loading]  - Estado de carga
 */
export default function StatCard({ label, value, icon, color, trend, loading = false }) {
    const [displayValue, setDisplayValue] = useState(0);
    const frameRef = useRef(null);

    // Animación de conteo al montar o al cambiar el valor
    useEffect(() => {
        if (loading || value === 0) {
            setDisplayValue(0);
            return;
        }

        const duration  = 1200; // ms
        const startTime = performance.now();
        const startVal  = 0;

        const animate = (currentTime) => {
            const elapsed  = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic: desacelera al final
            const eased    = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(Math.round(startVal + (value - startVal) * eased));

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value, loading]);

    if (loading) {
        return (
            <div className="stat-card stat-card--skeleton">
                <div className="stat-card__skeleton-icon" />
                <div className="stat-card__skeleton-value" />
                <div className="stat-card__skeleton-label" />
            </div>
        );
    }

    return (
        <article className={`stat-card stat-card--${color}`}>
            <div className="stat-card__header">
                <span className="stat-card__icon" aria-hidden="true">{icon}</span>
                {trend && (
                    <span className="stat-card__trend">{trend}</span>
                )}
            </div>
            <p className="stat-card__value">
                {displayValue.toLocaleString('es-VE')}
            </p>
            <p className="stat-card__label">{label}</p>
            <div className={`stat-card__accent stat-card__accent--${color}`} />
        </article>
    );
}
