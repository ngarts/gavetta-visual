#version 330

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define MAX_VERTICES 6


// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

float hash11(float p)
{
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}


vec2 rotate2D(vec2 p, float angle)
{
    float c = cos(angle);
    float s = sin(angle);

    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}


float distanceToSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 ab = b - a;
    float denom = max(dot(ab, ab), 0.000001);
    float h = clamp(dot(p - a, ab) / denom, 0.0, 1.0);
    return length(p - (a + ab * h));
}


// ------------------------------------------------------------
// Vertice di un frammento irregolare.
//
// Ogni forma mantiene una distribuzione angolare leggibile,
// ma raggio e angolo di ciascun vertice sono leggermente
// perturbati. In questo modo otteniamo triangoli, quadrilateri,
// pentagoni ed esagoni senza l'aspetto di poligoni perfetti.
// ------------------------------------------------------------

vec2 fragmentVertex(float id, int vertexIndex, int sideCount, float size)
{
    float fi = float(vertexIndex);
    float fs = float(sideCount);

    float angleJitter =
        (hash11(id * 31.71 + fi * 8.37 + 2.1) - 0.5)
        * (TWO_PI / fs)
        * 0.28;

    float angle =
        TWO_PI * fi / fs
        + angleJitter;

    float radiusJitter =
        mix(
            0.72,
            1.18,
            hash11(id * 17.13 + fi * 5.91 + 7.7)
        );

    // Leggera anisotropia: rende alcuni frammenti più allungati.
    float stretch =
        mix(
            0.78,
            1.28,
            hash11(id * 6.41 + 9.3)
        );

    vec2 v =
        vec2(cos(angle), sin(angle))
        * size
        * radiusJitter;

    v.x *= stretch;

    return v;
}


// ------------------------------------------------------------
// Distanza dal bordo del poligono.
// ------------------------------------------------------------

float fragmentEdge(vec2 p, float id, int sideCount, float size)
{
    float d = 1000.0;

    for (int j = 0; j < MAX_VERTICES; j++)
    {
        if (j >= sideCount)
            break;

        int nextIndex = j + 1;
        if (nextIndex >= sideCount)
            nextIndex = 0;

        vec2 a = fragmentVertex(id, j, sideCount, size);
        vec2 b = fragmentVertex(id, nextIndex, sideCount, size);

        d = min(d, distanceToSegment(p, a, b));
    }

    return d;
}


// ------------------------------------------------------------
// Palette
// ------------------------------------------------------------

vec3 fragmentColor(float id)
{
    float r = hash11(id * 11.7 + 4.2);

    vec3 red = vec3(0.98, 0.025, 0.08);
    vec3 magenta = vec3(1.00, 0.025, 0.58);
    vec3 violet = vec3(0.50, 0.055, 1.00);
    vec3 pink = vec3(1.00, 0.18, 0.48);

    if (r < 0.33)
        return mix(red, magenta, r / 0.33);

    if (r < 0.66)
        return mix(magenta, violet, (r - 0.33) / 0.33);

    return mix(violet, pink, (r - 0.66) / 0.34);
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    vec2 uv =
        (2.0 * gl_FragCoord.xy - u_resolution.xy)
        / u_resolution.y;


    // ========================================================
    // SFONDO
    // ========================================================

    vec3 color = vec3(0.004, 0.001, 0.012);

    float vignette =
        1.0 - smoothstep(0.1, 1.55, length(uv));

    color +=
        vec3(0.020, 0.003, 0.040)
        * vignette;


    // ========================================================
    // EVENTO MUSICALE
    // ========================================================

    float timeSinceEvent =
        max(u_time - u_eventTime, 0.0);


    // ========================================================
    // FRAMMENTI
    // ========================================================

    const int FRAGMENT_COUNT = 30;

    for (int i = 0; i < FRAGMENT_COUNT; i++)
    {
        float id = float(i);

        float seedA = hash11(id * 3.17 + 1.0);
        float seedB = hash11(id * 7.41 + 2.0);
        float seedC = hash11(id * 13.9 + 3.0);
        float seedD = hash11(id * 21.3 + 4.0);


        // ----------------------------------------------------
        // Numero di lati: da 3 a 6.
        // ----------------------------------------------------

        int sideCount =
            3 + int(floor(hash11(id * 19.73 + 5.0) * 4.0));

        sideCount = clamp(sideCount, 3, 6);


        // ----------------------------------------------------
        // Profondità e dimensione.
        // ----------------------------------------------------

        float depth = mix(0.58, 1.30, seedA);

        float size =
            mix(0.075, 0.155, seedC)
            / depth;


        // ----------------------------------------------------
        // Posizione di base.
        // ----------------------------------------------------

        vec2 basePosition =
            vec2(
                mix(-1.05, 1.05, seedB),
                mix(-0.70, 0.72, seedC)
            );


        // ----------------------------------------------------
        // Deriva lenta nello spazio.
        // ----------------------------------------------------

        vec2 drift =
            vec2(
                sin(
                    u_time * (0.15 + seedA * 0.11)
                    + seedB * TWO_PI
                ),
                cos(
                    u_time * (0.12 + seedC * 0.10)
                    + seedD * TWO_PI
                )
            );

        drift *= 0.030 + seedD * 0.030;


        // ----------------------------------------------------
        // Selezione per evento.
        //
        // u_eventTime cambia a ogni colpo. Combinandolo con
        // l'id otteniamo ogni volta un sottoinsieme diverso.
        // La selezione è pseudo-random ma deterministica.
        // ----------------------------------------------------

        float eventSelection =
            hash11(
                id * 17.31
                + u_eventTime * 13.73
                + floor(u_eventStrength * 9.0) * 0.37
            );

        // Circa il 38% dei frammenti reagisce a ogni evento.
        float selected =
            step(0.62, eventSelection);


        // ----------------------------------------------------
        // Ogni frammento selezionato ha ritardo, durata
        // e intensità differenti.
        // ----------------------------------------------------

        float delay =
            hash11(id * 9.19 + u_eventTime * 2.11)
            * 0.14;

        float localEventTime =
            max(timeSinceEvent - delay, 0.0);

        float decay =
            mix(
                3.2,
                7.2,
                hash11(id * 14.7 + u_eventTime * 1.33)
            );

        float pulseStrength =
            mix(
                0.70,
                1.55,
                hash11(id * 5.13 + u_eventTime * 4.27)
            );

        float eventPulse =
            selected
            * u_eventStrength
            * pulseStrength
            * exp(-decay * localEventTime);


        // ----------------------------------------------------
        // Spinta fisica solo sui frammenti selezionati.
        // ----------------------------------------------------

        vec2 pushDirection =
            normalize(
                vec2(
                    hash11(id * 4.7 + 8.0) - 0.5,
                    hash11(id * 6.9 + 3.0) - 0.5
                )
                + vec2(0.001, 0.002)
            );

        vec2 eventPush =
            pushDirection
            * eventPulse
            * 0.042;


        vec2 fragmentPosition =
            basePosition
            + drift
            + eventPush;


        // ----------------------------------------------------
        // Coordinate locali e rotazione.
        // ----------------------------------------------------

        vec2 p = uv - fragmentPosition;

        float rotationSpeed =
            mix(-0.32, 0.32, seedA);

        float angle =
            seedD * TWO_PI
            + u_time * rotationSpeed
            + eventPulse * 0.07 * (seedB - 0.5);

        p = rotate2D(p, angle);


        // ----------------------------------------------------
        // Bordo del poligono irregolare.
        // ----------------------------------------------------

        float d =
            fragmentEdge(
                p,
                id,
                sideCount,
                size
            );


        // ----------------------------------------------------
        // Core e glow.
        // ----------------------------------------------------

        float coreWidth =
            mix(0.0045, 0.0080, seedB);

        float core =
            1.0 - smoothstep(
                coreWidth * 0.20,
                coreWidth,
                d
            );

        float tightGlow =
            0.0048 / max(d, 0.0007);

        tightGlow = min(tightGlow, 3.8);

        float wideGlow =
            exp(
                -d * mix(42.0, 68.0, seedA)
            );


        // ----------------------------------------------------
        // Respirazione a riposo.
        // ----------------------------------------------------

        float idlePulse =
            0.80
            + 0.20
            * sin(
                u_time * (0.55 + seedB * 0.35)
                + seedC * TWO_PI
            );


        // ----------------------------------------------------
        // Profondità visiva.
        // ----------------------------------------------------

        float depthFade =
            mix(0.48, 1.0, clamp(1.0 / depth, 0.0, 1.0));


        // ----------------------------------------------------
        // Colore base.
        // ----------------------------------------------------

        vec3 baseColor =
            fragmentColor(id);


        // ----------------------------------------------------
        // Colore del lampo.
        //
        // Cambia da frammento a frammento e da evento a evento,
        // restando nella palette rosso-magenta-viola.
        // ----------------------------------------------------

        float pulseHue =
            hash11(
                id * 23.7
                + u_eventTime * 7.31
            );

        vec3 flashA = vec3(1.00, 0.08, 0.20);
        vec3 flashB = vec3(1.00, 0.06, 0.72);
        vec3 flashC = vec3(0.58, 0.10, 1.00);

        vec3 pulseColor;

        if (pulseHue < 0.5)
        {
            pulseColor =
                mix(flashA, flashB, pulseHue * 2.0);
        }
        else
        {
            pulseColor =
                mix(flashB, flashC, (pulseHue - 0.5) * 2.0);
        }


        // ----------------------------------------------------
        // Frammento a riposo.
        // ----------------------------------------------------

        color +=
            baseColor
            * core
            * 1.10
            * idlePulse
            * depthFade;

        color +=
            baseColor
            * tightGlow
            * 0.38
            * idlePulse
            * depthFade;

        color +=
            baseColor
            * wideGlow
            * 0.42
            * idlePulse
            * depthFade;


        // ----------------------------------------------------
        // Lampo: SOLO frammenti selezionati.
        // ----------------------------------------------------

        color +=
            pulseColor
            * core
            * eventPulse
            * 2.10
            * depthFade;

        color +=
            pulseColor
            * tightGlow
            * eventPulse
            * 0.60
            * depthFade;

        color +=
            pulseColor
            * wideGlow
            * eventPulse
            * 1.25
            * depthFade;
    }


    // ========================================================
    // HAZE
    // ========================================================

    float haze =
        exp(-length(uv) * 3.4);

    color +=
        vec3(0.08, 0.01, 0.13)
        * haze
        * 0.10;


    // ========================================================
    // TONEMAPPING
    // ========================================================

    color =
        1.0 - exp(-color * 1.18);

    fragColor =
        vec4(color, 1.0);
}
