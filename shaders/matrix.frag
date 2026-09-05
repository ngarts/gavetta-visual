#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;

#define PI 3.14159265359


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


float hash21(vec2 p)
{
    vec3 p3 =
        fract(
            vec3(p.xyx)
            * 0.1031
        );

    p3 +=
        dot(
            p3,
            p3.yzx + 33.33
        );

    return fract(
        (p3.x + p3.y)
        * p3.z
    );
}


vec2 rotate2D(
    vec2 p,
    float angle
)
{
    float c = cos(angle);
    float s = sin(angle);

    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}


// ------------------------------------------------------------
// Primitive luminose
// ------------------------------------------------------------

float sdBox(
    vec2 p,
    vec2 b
)
{
    vec2 d =
        abs(p) - b;

    return
        length(
            max(d, 0.0)
        )
        +
        min(
            max(d.x, d.y),
            0.0
        );
}


float segment(
    vec2 p,
    vec2 a,
    vec2 b,
    float width
)
{
    vec2 pa =
        p - a;

    vec2 ba =
        b - a;

    float h =
        clamp(
            dot(pa, ba)
            /
            max(
                dot(ba, ba),
                0.00001
            ),
            0.0,
            1.0
        );

    float d =
        length(
            pa - ba * h
        );

    return
        1.0 -
        smoothstep(
            width,
            width * 2.2,
            d
        );
}


// ------------------------------------------------------------
// Glifo procedurale
//
// Ogni cella sceglie una combinazione di segmenti.
// Nessun carattere reale: solo pseudo-simboli geometrici.
// ------------------------------------------------------------

float glyph(
    vec2 p,
    float seed
)
{
    float g =
        0.0;

    float a =
        hash11(
            seed * 11.7 + 1.0
        );

    float b =
        hash11(
            seed * 17.3 + 2.0
        );

    float c =
        hash11(
            seed * 23.9 + 3.0
        );

    float d =
        hash11(
            seed * 31.1 + 4.0
        );

    float w =
        0.045;


    // verticale centrale
    if (a > 0.35)
    {
        g = max(
            g,
            segment(
                p,
                vec2(0.0, -0.32),
                vec2(0.0,  0.32),
                w
            )
        );
    }


    // orizzontale alta
    if (b > 0.45)
    {
        g = max(
            g,
            segment(
                p,
                vec2(-0.24, 0.22),
                vec2( 0.24, 0.22),
                w
            )
        );
    }


    // orizzontale bassa
    if (c > 0.50)
    {
        g = max(
            g,
            segment(
                p,
                vec2(-0.24, -0.22),
                vec2( 0.24, -0.22),
                w
            )
        );
    }


    // diagonale /
    if (d > 0.58)
    {
        g = max(
            g,
            segment(
                p,
                vec2(-0.22, -0.28),
                vec2( 0.22,  0.28),
                w
            )
        );
    }


    // diagonale discendente
    if (
        hash11(
            seed * 41.9 + 5.0
        )
        > 0.62
    )
    {
        g = max(
            g,
            segment(
                p,
                vec2(-0.22,  0.28),
                vec2( 0.22, -0.28),
                w
            )
        );
    }


    // piccolo quadrato
    if (
        hash11(
            seed * 53.1 + 6.0
        )
        > 0.72
    )
    {
        float box =
            1.0 -
            smoothstep(
                0.0,
                0.045,
                abs(
                    sdBox(
                        p,
                        vec2(
                            0.14,
                            0.14
                        )
                    )
                )
            );

        g = max(
            g,
            box
        );
    }


    // piccolo punto
    if (
        hash11(
            seed * 67.7 + 7.0
        )
        > 0.75
    )
    {
        float dotShape =
            1.0 -
            smoothstep(
                0.03,
                0.09,
                length(
                    p
                    - vec2(
                        0.0,
                        0.27
                    )
                )
            );

        g = max(
            g,
            dotShape
        );
    }


    return g;
}


// ------------------------------------------------------------
// Layer Matrix
// ------------------------------------------------------------

vec3 matrixLayer(
    vec2 uv,
    float scale,
    float speed,
    float depth,
    float layerSeed,
    float eventPulse
)
{
    // --------------------------------------------------------
    // Griglia
    // --------------------------------------------------------

    vec2 grid =
        uv * scale;

    float column =
        floor(grid.x);

    float columnSeed =
        hash11(
            column * 13.7
            + layerSeed
        );


    // Ogni colonna ha una sua velocità.
    float columnSpeed =
        speed
        * mix(
            0.72,
            1.42,
            columnSeed
        );


    // Offset verticale indipendente.
    float offset =
        u_time * columnSpeed
        +
        columnSeed * 19.0;


    grid.y +=
        offset;


    vec2 cell =
        floor(grid);

    vec2 local =
        fract(grid)
        - 0.5;


    float row =
        cell.y;

    float seed =
        column * 71.3
        +
        row * 17.9
        +
        layerSeed * 101.0;


    // --------------------------------------------------------
    // Glifo
    // --------------------------------------------------------

    float g =
        glyph(
            local * 1.65,
            seed
        );


    // --------------------------------------------------------
    // Testa della colonna
    //
    // Creiamo una zona brillante che scende insieme alla colonna.
    // --------------------------------------------------------

    float streamLength =
        mix(
            5.0,
            12.0,
            hash11(
                column * 9.3
                + layerSeed
            )
        );

    float headRow =
        floor(
            mod(
                offset
                + columnSeed * 23.0,
                streamLength + 7.0
            )
        );


    float distanceFromHead =
        mod(
            headRow
            - mod(row, streamLength + 7.0)
            + streamLength + 7.0,
            streamLength + 7.0
        );


    float trail =
        exp(
            -distanceFromHead
            * 0.46
        );


    // Alcune celle non vengono disegnate:
    // rende le colonne meno uniformi.
    float occupancy =
        step(
            0.25,
            hash11(
                seed * 1.73
            )
        );


    g *=
        occupancy
        * trail;


    // --------------------------------------------------------
    // Evento: solo alcune colonne reagiscono
    // --------------------------------------------------------

    float eventSelection =
        hash11(
            column * 29.7
            +
            floor(
                u_eventTime * 23.0
            )
            +
            layerSeed * 7.0
        );

    float selected =
        step(
            0.68,
            eventSelection
        );


    float eventBoost =
        1.0
        +
        selected
        * eventPulse
        * 2.4;


    // --------------------------------------------------------
    // Colore
    // --------------------------------------------------------

    vec3 deepRed =
        vec3(
            0.32,
            0.003,
            0.018
        );

    vec3 red =
        vec3(
            1.00,
            0.015,
            0.08
        );

    vec3 magenta =
        vec3(
            1.00,
            0.018,
            0.48
        );

    vec3 hotPink =
        vec3(
            1.00,
            0.32,
            0.68
        );


    float hue =
        hash11(
            column * 5.7
            + layerSeed
        );

    vec3 glyphColor;

    if (hue < 0.42)
    {
        glyphColor =
            mix(
                deepRed,
                red,
                hue / 0.42
            );
    }
    else
    {
        glyphColor =
            mix(
                red,
                magenta,
                (hue - 0.42) / 0.58
            );
    }


    // La testa della colonna è più calda.
    float headGlow =
        exp(
            -distanceFromHead
            * 1.2
        );

    glyphColor =
        mix(
            glyphColor,
            hotPink,
            headGlow * 0.70
        );


    // Layer lontani = meno intensi.
    return
        glyphColor
        * g
        * eventBoost
        * depth;
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    // ========================================================
    // Coordinate
    // ========================================================

    vec2 uv =
        (
            2.0 * gl_FragCoord.xy
            - u_resolution.xy
        )
        / u_resolution.y;


    // ========================================================
    // Sfondo
    // ========================================================

    vec3 color =
        vec3(
            0.002,
            0.0002,
            0.006
        );

    float vignette =
        1.0 -
        smoothstep(
            0.10,
            1.55,
            length(uv)
        );

    color +=
        vec3(
            0.015,
            0.0006,
            0.018
        )
        * vignette;


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
            -5.0 * timeSinceEvent
        );


    // ========================================================
    // Profondità / prospettiva
    //
    // I layer lontani sono più piccoli, più lenti e meno luminosi.
    // ========================================================

    vec3 farLayer =
        matrixLayer(
            uv + vec2(0.018, 0.0),
            14.0,
            0.65,
            0.32,
            1.0,
            eventPulse
        );


    vec3 midLayer =
        matrixLayer(
            uv,
            10.0,
            0.92,
            0.58,
            2.0,
            eventPulse
        );


    vec3 nearLayer =
        matrixLayer(
            uv - vec2(0.024, 0.0),
            7.0,
            1.20,
            0.92,
            3.0,
            eventPulse
        );


    color +=
        farLayer;

    color +=
        midLayer;

    color +=
        nearLayer;


    // ========================================================
    // Glow globale
    // ========================================================

    float redHaze =
        exp(
            -abs(uv.x)
            * 1.7
        );

    color +=
        vec3(
            0.08,
            0.002,
            0.018
        )
        * redHaze
        * 0.18;


    // Flash ambientale leggerissimo sugli eventi.
    color +=
        vec3(
            0.10,
            0.002,
            0.025
        )
        * eventPulse
        * 0.055;


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
