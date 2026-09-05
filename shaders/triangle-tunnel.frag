#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

#define PI 3.14159265359


mat2 rotate2D(float angle)
{
    float c = cos(angle);
    float s = sin(angle);

    return mat2(
         c, -s,
         s,  c
    );
}


// ------------------------------------------------------------
// Distanza dal bordo di un triangolo equilatero
//
// Restituisce una distanza "approssimata" dal contorno.
// Ci interessa soprattutto ottenere una linea pulita,
// non costruire una vera SDF 3D.
// ------------------------------------------------------------

float triangleEdge(vec2 p, float size)
{
    const float k = 1.73205080757; // sqrt(3)

    /*
        SDF di un triangolo equilatero.

        abs(p.x)
        sfrutta la simmetria verticale del triangolo.

        - size
        sposta la coordinata rispetto al vertice/lato destro.
        Questa era la parte che mancava nella versione precedente.
    */
    p.x = abs(p.x) - size;
    p.y = p.y + size / k;

    /*
        Se il punto si trova oltre il lato inclinato,
        lo riflettiamo nel settore fondamentale del triangolo.
    */
    if (p.x + k * p.y > 0.0)
    {
        p = vec2(
            p.x - k * p.y,
            -k * p.x - p.y
        ) / 2.0;
    }

    /*
        Distanza dal segmento inferiore.
    */
    p.x -= clamp(
        p.x,
        -2.0 * size,
        0.0
    );

    /*
        Questa è la signed distance vera e propria.
        Negativa dentro, positiva fuori.
    */
    float d =
        -length(p) * sign(p.y);

    /*
        A noi interessa il CONTORNO,
        quindi dentro/fuori non importa:
        vogliamo solo la distanza dal bordo.
    */
    return abs(d);
}


// ------------------------------------------------------------
// Singolo triangolo luminoso
//
// Usiamo una intensità I inversamente proporzionale
// alla distanza dal bordo.
//
// È lo stesso principio concettuale del ring:
//
//     I ~ 1 / distanza
//
// Più ci avviciniamo alla linea,
// più la luce esplode.
// ------------------------------------------------------------

float glowingTriangle(
    vec2 p,
    float size,
    float thickness
)
{
    float d = triangleEdge(p, size);

    // --------------------------------------------------------
    // Corpo luminoso del bordo
    //
    // Crea una vera linea con uno spessore percepibile,
    // invece di affidarsi soltanto al glow 1/d.
    // --------------------------------------------------------

    float coreWidth = thickness * 2.2;

    float core =
        1.0 - smoothstep(
            coreWidth * 0.35,
            coreWidth,
            d
        );


    // --------------------------------------------------------
    // Glow esterno
    //
    // È il nostro effetto I:
    //
    //      I = thickness / distanza
    //
    // ma ora lavora ATTORNO a un bordo già consistente.
    // --------------------------------------------------------

    float glowDistance =
        max(d, 0.0005);

    float I =
        thickness / glowDistance;

    I = min(I, 3.0);


    // --------------------------------------------------------
    // Combinazione
    //
    // core = bordo vero
    // I    = alone luminoso
    // --------------------------------------------------------

    return core * 1.35 + I * 0.65;
}


// ------------------------------------------------------------
// Palette
//
// Il parametro t varia lungo il tunnel.
// Non vogliamo arcobaleno pieno:
// restiamo tra viola, magenta, rosso e blu.
// ------------------------------------------------------------

vec3 tunnelColor(float t)
{
    vec3 purple = vec3(0.42, 0.05, 0.85);
    vec3 magenta = vec3(0.95, 0.05, 0.55);
    vec3 red = vec3(1.00, 0.08, 0.12);
    vec3 blue = vec3(0.08, 0.20, 1.00);

    float phase = fract(t);

    if (phase < 0.333)
    {
        return mix(
            purple,
            magenta,
            phase / 0.333
        );
    }

    if (phase < 0.666)
    {
        return mix(
            magenta,
            red,
            (phase - 0.333) / 0.333
        );
    }

    return mix(
        red,
        blue,
        (phase - 0.666) / 0.334
    );
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    // --------------------------------------------------------
    // Coordinate normalizzate
    // --------------------------------------------------------

    vec2 uv =
        (2.0 * gl_FragCoord.xy - u_resolution.xy)
        / u_resolution.y;


    // --------------------------------------------------------
    // Sfondo
    // --------------------------------------------------------

    float vignette =
        1.0 - smoothstep(
            0.15,
            1.45,
            length(uv)
        );

    vec3 background =
        vec3(0.008, 0.002, 0.018);

    background +=
        vec3(0.025, 0.005, 0.055)
        * vignette;


    vec3 color = background;


    // --------------------------------------------------------
    // Tunnel
    // --------------------------------------------------------

    const int TRIANGLE_COUNT = 3;

    float speed = 0.42;

    // Movimento continuo lungo il tunnel
    float travel = u_time * speed;


    for (int i = 0; i < TRIANGLE_COUNT; i++)
    {
        float fi = float(i);


        // ----------------------------------------------------
        // Profondità ciclica
        //
        // z va da 0 → 1.
        //
        // Quando supera 1 torna in fondo.
        // ----------------------------------------------------

        float z = fract(
            fi / float(TRIANGLE_COUNT)
            + travel
        );


        // ----------------------------------------------------
        // Prospettiva
        //
        // z ≈ 0  → triangolo lontano
        // z ≈ 1  → triangolo vicino
        //
        // La crescita non è lineare:
        // acceleriamo mentre arriva verso di noi.
        // ----------------------------------------------------

        float perspective =
            pow(z, 2.0);

        float size =
            mix(
                0.08,
                2.8,
                perspective
            );


        // ----------------------------------------------------
        // Punto di fuga mobile
        //
        // Il tunnel non è perfettamente centrato.
        // Oscilla lentamente creando la sensazione
        // di un percorso che curva.
        // ----------------------------------------------------

        vec2 vanishingPoint;

        vanishingPoint.x =
            sin(
                u_time * 0.31
                + z * 5.0
            )
            * 0.10
            * (1.0 - z);

        vanishingPoint.y =
            cos(
                u_time * 0.23
                + z * 4.0
            )
            * 0.065
            * (1.0 - z);


        vec2 p = uv - vanishingPoint;


        // ----------------------------------------------------
        // Torsione progressiva
        //
        // I triangoli più profondi e quelli più vicini
        // non hanno esattamente lo stesso orientamento.
        // ----------------------------------------------------

        float twist =
            sin(
                u_time * 0.35
                + z * 7.0
            )
            * 0.16;

        twist +=
            (z - 0.5)
            * 0.22;

        p = rotate2D(twist) * p;


        // ----------------------------------------------------
        // Piccola deformazione del tunnel
        //
        // Non vogliamo triangoli completamente rigidi.
        // Introduciamo una lieve curvatura.
        // ----------------------------------------------------

        float bend =
            sin(
                p.y * 3.0
                + u_time * 0.6
                + fi
            )
            * 0.018
            * z;

        p.x += bend;


        // ----------------------------------------------------
        // Glow
        // ----------------------------------------------------

        float thickness =
            mix(
                0.0035,
                0.014,
                z
            );

        float I =
            glowingTriangle(
                p,
                size,
                thickness
            );

        // ------------------------------------------------------------
        // Event glow
        //
        // L'evento arriva istantaneamente e poi decade.
        //
        // u_eventStrength = intensità dell'evento
        // u_eventTime     = istante in cui è avvenuto
        // ------------------------------------------------------------

        float timeSinceEvent =
            max(u_time - u_eventTime, 0.0);

        float eventGlow =
            u_eventStrength
            * exp(-5.0 * timeSinceEvent);

        // ----------------------------------------------------
        // Dissolvenza in profondità
        //
        // I triangoli molto lontani devono essere più deboli.
        // ----------------------------------------------------

        float depthFade =
            smoothstep(
                0.02,
                0.30,
                z
            );


        // ----------------------------------------------------
        // Dissolvenza quando il triangolo passa la camera
        //
        // Evita il "pop" improvviso prima del riciclo.
        // ----------------------------------------------------

        float nearFade =
            1.0 - smoothstep(
                0.82,
                1.0,
                z
            );


        float visibility =
            depthFade
            * nearFade;


        // ----------------------------------------------------
        // Leggera pulsazione autonoma
        //
        // In futuro qui entreranno i livelli audio.
        // ----------------------------------------------------

        float pulse =
            0.82
            + 0.18
            * sin(
                u_time * 2.0
                + fi * 0.7
            );


        // ----------------------------------------------------
        // Colore del triangolo
        // ----------------------------------------------------

        vec3 triangleColor =
            tunnelColor(
                fi * 0.13
                + u_time * 0.035
            );


        // ----------------------------------------------------
        // Accumulo additivo
        //
        // È qui che il tunnel diventa realmente luminoso:
        // ogni triangolo aggiunge luce.
        // ----------------------------------------------------

            float eventBoost =
                1.0 + eventGlow * 1.8;

            color +=
                triangleColor
                * I
                * visibility
                * pulse
                * eventBoost
                * 0.42;
    }


    // --------------------------------------------------------
    // Nebbia luminosa centrale
    //
    // Serve a suggerire che il tunnel continua oltre
    // i triangoli che riusciamo a distinguere.
    // --------------------------------------------------------

    float centerGlow =
        exp(
            -length(uv)
            * 5.0
        );

    color +=
        vec3(
            0.18,
            0.025,
            0.32
        )
        * centerGlow
        * 0.35;


    // --------------------------------------------------------
    // Tonemapping molto semplice
    //
    // Il glow additivo può superare 1.
    // Questa formula mantiene le alte luci morbide.
    // --------------------------------------------------------

    color =
        1.0 - exp(-color * 1.25);


    // --------------------------------------------------------
    // Output
    // --------------------------------------------------------

    fragColor =
        vec4(
            color,
            1.0
        );
}