#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;

#define PI 3.14159265359
#define TWO_PI 6.28318530718


// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

float saturate(float x)
{
    return clamp(x, 0.0, 1.0);
}


float angularDistance(float a, float b)
{
    float d = abs(a - b);
    return min(d, TWO_PI - d);
}


vec2 rotate2D(vec2 p, float a)
{
    float c = cos(a);
    float s = sin(a);

    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}


// ------------------------------------------------------------
// Lemniscata deformata
//
// Non è perfettamente simmetrica:
// - il lobo sinistro è appena più largo;
// - il destro è appena più alto;
// - c'è una lieve deviazione organica.
//
// La forma resta comunque chiaramente un "infinito".
// ------------------------------------------------------------

vec2 infinityPoint(float t)
{
    float s = sin(t);
    float c = cos(t);

    float denom =
        1.0 + s * s;

    vec2 q =
        vec2(
            1.20 * c / denom,
            0.75 * s * c / denom
        );

    float side =
        clamp(
            q.x / 1.20,
            -1.0,
            1.0
        );

    // Lobo sinistro leggermente più largo.
    q.x *=
        1.0
        - 0.055 * side;

    // Lobo destro appena più alto.
    q.y *=
        1.0
        + 0.080 * side;

    // Piccola asimmetria verticale.
    q.y +=
        0.025 * side;

    // Irregolarità molto lieve, sufficiente a togliere
    // l'impressione di figura matematica perfetta.
    q.y +=
        0.018
        * sin(
            2.0 * t + 0.55
        );

    return q;
}


// ------------------------------------------------------------
// Profondità virtuale
//
// I due passaggi centrali hanno profondità opposta:
// uno passa davanti, l'altro dietro.
// ------------------------------------------------------------

float infinityDepth(float t)
{
    return sin(t);
}


// ------------------------------------------------------------
// Distanza da segmento + coordinata locale
// ------------------------------------------------------------

float distanceToSegment(
    vec2 p,
    vec2 a,
    vec2 b,
    out float h
)
{
    vec2 pa = p - a;
    vec2 ba = b - a;

    float denom =
        max(
            dot(ba, ba),
            0.000001
        );

    h =
        clamp(
            dot(pa, ba) / denom,
            0.0,
            1.0
        );

    return length(
        pa - ba * h
    );
}


// ------------------------------------------------------------
// Ricerca per ramo
//
// Manteniamo i due rami distinti per gestire la profondità
// nell'intersezione.
// ------------------------------------------------------------

void findBranch(
    vec2 p,
    int branch,
    out float minDistance,
    out float nearestT
)
{
    minDistance =
        1000.0;

    nearestT =
        0.0;

    const int SEGMENTS_PER_BRANCH =
        120;

    float tStart =
        (
            branch == 0
            ? 0.0
            : PI
        );

    float tEnd =
        (
            branch == 0
            ? PI
            : TWO_PI
        );

    float previousT =
        tStart;

    vec2 previous =
        infinityPoint(
            previousT
        );

    for (
        int i = 1;
        i <= SEGMENTS_PER_BRANCH;
        i++
    )
    {
        float u =
            float(i)
            /
            float(SEGMENTS_PER_BRANCH);

        float t =
            mix(
                tStart,
                tEnd,
                u
            );

        vec2 current =
            infinityPoint(t);

        float h;

        float d =
            distanceToSegment(
                p,
                previous,
                current,
                h
            );

        if (d < minDistance)
        {
            minDistance =
                d;

            nearestT =
                mix(
                    previousT,
                    t,
                    h
                );
        }

        previous =
            current;

        previousT =
            t;
    }
}


// ------------------------------------------------------------
// Materiale vetro
// ------------------------------------------------------------

vec3 glassMaterial(
    float d,
    float t,
    float thickness,
    float eventPulse
)
{
    float body =
        1.0 -
        smoothstep(
            thickness,
            thickness + 0.018,
            d
        );

    if (body <= 0.0)
    {
        return vec3(0.0);
    }


    float radial =
        saturate(
            d / thickness
        );

    // Sezione tondeggiante.
    float dome =
        sqrt(
            max(
                1.0 - radial * radial,
                0.0
            )
        );

    // Fresnel.
    float fresnel =
        pow(
            radial,
            3.0
        );


    vec3 deepViolet =
        vec3(
            0.075,
            0.006,
            0.20
        );

    vec3 violet =
        vec3(
            0.46,
            0.025,
            1.00
        );

    vec3 magenta =
        vec3(
            1.00,
            0.018,
            0.50
        );

    vec3 hotPink =
        vec3(
            1.00,
            0.30,
            0.68
        );


    float hueFlow =
        0.5
        + 0.5
        * sin(
            t * 1.45
            - u_time * 0.14
        );

    vec3 tint =
        mix(
            violet,
            magenta,
            hueFlow
        );


    vec3 result =
        mix(
            deepViolet,
            tint,
            0.55
        )
        * body
        * (
            0.10
            + 0.30 * dome
            + 0.48 * fresnel
        );


    // Highlight principale.
    float specCenter =
        0.30
        + 0.08
        * sin(
            t * 2.0
            - u_time * 0.35
        );

    float specular =
        exp(
            -pow(
                radial - specCenter,
                2.0
            )
            * 120.0
        );

    result +=
        hotPink
        * body
        * specular
        * 0.72;


    // Highlight freddo secondario.
    float specular2 =
        exp(
            -pow(
                radial - 0.72,
                2.0
            )
            * 85.0
        );

    result +=
        violet
        * body
        * specular2
        * 0.34;


    // Venature interne.
    float caustic =
        0.5
        + 0.5
        * sin(
            t * 10.0
            - u_time * 0.80
            + radial * 6.0
        );

    caustic *=
        0.5
        + 0.5
        * sin(
            t * 5.0
            + u_time * 0.37
            - radial * 9.0
        );

    caustic =
        pow(
            saturate(caustic),
            5.0
        );

    result +=
        hotPink
        * body
        * caustic
        * dome
        * 0.16;


    // Respiro musicale.
    result +=
        magenta
        * body
        * fresnel
        * eventPulse
        * 0.12;


    return result;
}


// ------------------------------------------------------------
// Fascio luminoso
// ------------------------------------------------------------

vec3 pulseMaterial(
    float d,
    float t,
    float thickness,
    float eventPulse,
    float pulseT
)
{
    float body =
        1.0 -
        smoothstep(
            thickness,
            thickness + 0.018,
            d
        );

    if (body <= 0.0)
    {
        return vec3(0.0);
    }


    float radial =
        saturate(
            d / thickness
        );

    float fresnel =
        pow(
            radial,
            2.7
        );


    float delta =
        angularDistance(
            t,
            pulseT
        );

    float head =
        exp(
            -delta
            * delta
            * 22.0
        );


    float trailing =
        mod(
            pulseT
            - t
            + TWO_PI,
            TWO_PI
        );

    float tail =
        exp(
            -trailing * 3.0
        );

    tail *=
        1.0 -
        smoothstep(
            0.0,
            1.45,
            trailing
        );


    float pulseIntensity =
        0.62
        + eventPulse * 2.15;


    vec3 hotPink =
        vec3(
            1.00,
            0.34,
            0.70
        );

    vec3 violet =
        vec3(
            0.58,
            0.04,
            1.00
        );


    vec3 result =
        hotPink
        * body
        * head
        * (
            0.30
            + fresnel * 1.35
        )
        * pulseIntensity;


    result +=
        violet
        * body
        * tail
        * (
            0.12
            + fresnel * 0.72
        )
        * pulseIntensity;


    return result;
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    vec2 uv =
        (
            2.0 * gl_FragCoord.xy
            - u_resolution.xy
        )
        / u_resolution.y;


    // ========================================================
    // Inquadratura
    //
    // Ruotiamo le coordinate dell'immagine in senso opposto
    // alla forma: il risultato visivo è un infinito leggermente
    // inclinato, non perfettamente orizzontale.
    // ========================================================

    vec2 p =
        uv / 1.62;

    p =
        rotate2D(
            p,
            -0.105
        );

    // Piccolo decentramento cinematografico.
    p +=
        vec2(
            0.015,
            -0.008
        );


    // ========================================================
    // Sfondo astratto
    //
    // Più presente del precedente, ma sempre molto morbido.
    // Deve creare profondità dietro al vetro senza sembrare
    // una scena separata.
    // ========================================================

    vec3 backgroundBlack =
        vec3(
            0.003,
            0.0005,
            0.008
        );

    vec3 backgroundViolet =
        vec3(
            0.16,
            0.012,
            0.22
        );


    // --------------------------------------------------------
    // Grande alone centrale
    // --------------------------------------------------------

    float radialGlow =
        exp(
            -length(
                uv
                *
                vec2(
                    0.72,
                    1.05
                )
            )
            * 1.10
        );


    float slowBreath =
        0.90
        +
        0.10
        *
        sin(
            u_time
            *
            0.16
        );


    vec3 color =
        mix(
            backgroundBlack,
            backgroundViolet,
            radialGlow
            *
            0.82
            *
            slowBreath
        );


    // --------------------------------------------------------
    // Alone dietro il lobo sinistro
    // --------------------------------------------------------

    float glowLeft =
        exp(
            -dot(
                (
                    uv
                    -
                    vec2(
                        -0.72,
                        0.02
                    )
                )
                *
                vec2(
                    0.72,
                    1.12
                ),

                (
                    uv
                    -
                    vec2(
                        -0.72,
                        0.02
                    )
                )
                *
                vec2(
                    0.72,
                    1.12
                )
            )
            * 1.8
        );


    // --------------------------------------------------------
    // Alone dietro il lobo destro
    // --------------------------------------------------------

    float glowRight =
        exp(
            -dot(
                (
                    uv
                    -
                    vec2(
                        0.72,
                        -0.02
                    )
                )
                *
                vec2(
                    0.72,
                    1.12
                ),

                (
                    uv
                    -
                    vec2(
                        0.72,
                        -0.02
                    )
                )
                *
                vec2(
                    0.72,
                    1.12
                )
            )
            * 1.8
        );


    color +=
        vec3(
            0.13,
            0.008,
            0.19
        )
        *
        (
            glowLeft
            +
            glowRight
        )
        *
        0.70;


    // --------------------------------------------------------
    // Incrocio centrale
    // --------------------------------------------------------

    float centerGlow =
        exp(
            -dot(
                uv
                *
                vec2(
                    1.15,
                    1.45
                ),

                uv
                *
                vec2(
                    1.15,
                    1.45
                )
            )
            * 2.0
        );


    color +=
        vec3(
            0.20,
            0.015,
            0.28
        )
        *
        centerGlow
        *
        0.48;


    // --------------------------------------------------------
    // Leggerissima texture atmosferica
    //
    // Non è noise visibile: serve solo a evitare che
    // il gradiente sembri perfettamente digitale.
    // --------------------------------------------------------

    float atmosphere =
        0.5
        +
        0.5
        *
        sin(
            uv.x * 3.1
            +
            uv.y * 2.4
            +
            u_time * 0.06
        );


    color +=
        vec3(
            0.018,
            0.002,
            0.030
        )
        *
        atmosphere
        *
        radialGlow;


    // --------------------------------------------------------
    // Vignettatura
    // --------------------------------------------------------

    float vignette =
        1.0
        -
        smoothstep(
            0.70,
            1.75,
            length(uv)
        );


    color *=
        0.68
        +
        vignette
        *
        0.32;


    // ========================================================
    // Evento musicale
    // ========================================================

    float timeSinceEvent =
        max(
            u_time - u_eventTime,
            0.0
        );

    float eventPulse =
        u_eventStrength
        * exp(
            -4.4 * timeSinceEvent
        );


    // ========================================================
    // Due rami
    // ========================================================

    float dA;
    float tA;

    float dB;
    float tB;

    findBranch(
        p,
        0,
        dA,
        tA
    );

    findBranch(
        p,
        1,
        dB,
        tB
    );


    float thickness =
        0.155;


    float bodyA =
        1.0 -
        smoothstep(
            thickness,
            thickness + 0.018,
            dA
        );

    float bodyB =
        1.0 -
        smoothstep(
            thickness,
            thickness + 0.018,
            dB
        );


    // ========================================================
    // BASE CONTINUA DEL TUBO
    //
    // Questo è il cambiamento che elimina i piccoli "cerchi"
    // alle estremità.
    //
    // Non sommiamo più due capsule indipendenti agli estremi:
    // usiamo la distanza minima come un'unica forma continua.
    // ========================================================

 float dUnion =
    min(
        dA,
        dB
    );


// ========================================================
// Fusione continua dei due rami
//
// Prima sceglievamo tA oppure tB con:
//
//     dA < dB ? tA : tB
//
// Nell'incrocio questa scelta produceva confini geometrici
// netti: i "triangoli" visibili nel materiale.
//
// Ora calcoliamo separatamente i due materiali e li
// fondiamo gradualmente in base alla distanza dai rami.
// ========================================================

    vec3 baseGlassA =
        glassMaterial(
            dA,
            tA,
            thickness,
            eventPulse
        );

    vec3 baseGlassB =
        glassMaterial(
            dB,
            tB,
            thickness,
            eventPulse
        );


    // Quanto siamo più vicini ad A rispetto a B.
    // La fascia ±0.055 crea una zona di fusione abbastanza
    // larga da eliminare il confine senza sfocare il tubo.
    float branchBlend =
        smoothstep(
            -0.055,
            0.055,
            dB - dA
        );


    vec3 continuousGlass =
        mix(
            baseGlassB,
            baseGlassA,
            branchBlend
        );


    // ========================================================
    // Profondità
    // ========================================================

    float depthA =
        infinityDepth(tA);

    float depthB =
        infinityDepth(tB);

    // ========================================================
    // Zona di intersezione
    // ========================================================

    float overlap =
        bodyA
        * bodyB;


    // --------------------------------------------------------
    // Maschera morbida dell'incrocio
    //
    // L'overlap puro segue troppo fedelmente i bordi dei due
    // tubi e può creare tagli visibili. Lo rendiamo più morbido
    // prima di usarlo per l'occlusione.
    // --------------------------------------------------------

    float softOverlap =
        smoothstep(
            0.0,
            0.85,
            overlap
        );

    softOverlap *=
        softOverlap;


    // Il vetro continuo resta sempre la base.
    color +=
        continuousGlass;


    // --------------------------------------------------------
    // Profondità morbida
    //
    // Non "tagliamo" il tubo posteriore: lo attenuiamo
    // progressivamente nell'area in cui passa sotto l'altro.
    // --------------------------------------------------------

    float frontA =
        smoothstep(
            -0.12,
            0.28,
            depthA - depthB
        );

    float frontB =
        smoothstep(
            -0.12,
            0.28,
            depthB - depthA
        );


    // Riduzione molto più delicata della base.
    // Prima era 0.20 sull'overlap diretto: troppo visibile.
    float intersectionDim =
        softOverlap
        * 0.08;

    color *=
        1.0
        - intersectionDim;


    // Materiali dei due rami.
    vec3 glassA =
        glassMaterial(
            dA,
            tA,
            thickness,
            eventPulse
        );

    vec3 glassB =
        glassMaterial(
            dB,
            tB,
            thickness,
            eventPulse
        );


    // --------------------------------------------------------
    // Il ramo davanti viene rinforzato gradualmente.
    //
    // Usiamo softOverlap e una depth mask larga per evitare
    // qualsiasi cambio netto nell'incrocio.
    // --------------------------------------------------------

    color +=
        glassA
        * softOverlap
        * frontA
        * 0.42;

    color +=
        glassB
        * softOverlap
        * frontB
        * 0.42;


    // ========================================================
    // Fascio luminoso
    // ========================================================

    float pulseT =
        mod(
            u_time * 1.10,
            TWO_PI
        );


    vec3 pulseA =
        pulseMaterial(
            dA,
            tA,
            thickness,
            eventPulse,
            pulseT
        );

    vec3 pulseB =
        pulseMaterial(
            dB,
            tB,
            thickness,
            eventPulse,
            pulseT
        );


    // Se il fascio passa sul ramo posteriore, all'incrocio
    // sparisce davvero dietro il ramo frontale.
    float pulseVisibilityA =
        1.0
        - softOverlap
        * frontB
        * 0.92;

    float pulseVisibilityB =
        1.0
        - softOverlap
        * frontA
        * 0.92;


    color +=
        pulseA
        * pulseVisibilityA;

    color +=
        pulseB
        * pulseVisibilityB;


    // ========================================================
    // Glow esterno molto morbido
    // ========================================================

    float outerGlow =
        exp(
            -max(
                dUnion - thickness,
                0.0
            )
            * 24.0
        );

    outerGlow *=
        1.0 -
        smoothstep(
            thickness,
            thickness + 0.22,
            dUnion
        );

    color +=
        vec3(
            0.48,
            0.015,
            0.72
        )
        * outerGlow
        * 0.10;


    // ========================================================
    // Tonemapping
    // ========================================================

    color =
        1.0 -
        exp(
            -color * 1.18
        );


    fragColor =
        vec4(
            color,
            1.0
        );
}
