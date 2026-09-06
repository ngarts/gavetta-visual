#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;


// ------------------------------------------------------------
// Hash
// ------------------------------------------------------------

float hash21(vec2 p)
{
    p =
        fract(
            p
            *
            vec2(
                123.34,
                456.21
            )
        );

    p +=
        dot(
            p,
            p + 45.32
        );

    return
        fract(
            p.x * p.y
        );
}


// ------------------------------------------------------------
// Noise 2D
// ------------------------------------------------------------

float noise(vec2 p)
{
    vec2 i =
        floor(p);

    vec2 f =
        fract(p);

    f =
        f * f
        *
        (
            3.0
            -
            2.0 * f
        );


    float a =
        hash21(
            i
        );

    float b =
        hash21(
            i
            +
            vec2(
                1.0,
                0.0
            )
        );

    float c =
        hash21(
            i
            +
            vec2(
                0.0,
                1.0
            )
        );

    float d =
        hash21(
            i
            +
            vec2(
                1.0,
                1.0
            )
        );


    return
        mix(
            mix(
                a,
                b,
                f.x
            ),

            mix(
                c,
                d,
                f.x
            ),

            f.y
        );
}


// ------------------------------------------------------------
// FBM
// ------------------------------------------------------------

float fbm(vec2 p)
{
    float value = 0.0;
    float amplitude = 0.5;

    mat2 rotation =
        mat2(
             0.80,  0.60,
            -0.60,  0.80
        );


    for (
        int i = 0;
        i < 6;
        i++
    )
    {
        value +=
            amplitude
            *
            noise(p);

        p =
            rotation
            *
            p
            *
            2.03;

        amplitude *=
            0.50;
    }


    return value;
}


// ------------------------------------------------------------
// Domain warp
//
// Distorge lo spazio usando altro rumore.
// È questo che trasforma il noise in strutture
// simili a correnti, filamenti e masse.
// ------------------------------------------------------------

vec2 warpField(vec2 p)
{
    vec2 q =
        vec2(
            fbm(
                p
                +
                vec2(
                    0.0,
                    0.0
                )
            ),

            fbm(
                p
                +
                vec2(
                    5.2,
                    1.3
                )
            )
        );


    vec2 r =
        vec2(
            fbm(
                p
                +
                3.5 * q
                +
                vec2(
                    1.7,
                    9.2
                )
            ),

            fbm(
                p
                +
                3.5 * q
                +
                vec2(
                    8.3,
                    2.8
                )
            )
        );


    return r;
}


// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

void main()
{
    vec2 uv =
        (
            2.0
            *
            gl_FragCoord.xy
            -
            u_resolution.xy
        )
        /
        u_resolution.y;

    // --------------------------------------------------------
    // Rotazione lenta dell'inquadratura
    //
    // Ruotiamo l'intero spazio prima di generare la nebula.
    // La struttura rimane invariata: cambia soltanto
    // l'orientamento della "camera".
    //
    // Segno negativo = senso orario.
    // --------------------------------------------------------

    float rotationAngle =
        -u_time
        *
        0.035;


    float cs =
        cos(
            rotationAngle
        );

    float sn =
        sin(
            rotationAngle
        );


    mat2 cameraRotation =
        mat2(
            cs, -sn,
            sn,  cs
        );


    uv =
        cameraRotation
        *
        uv;


    // --------------------------------------------------------
    // Evento musicale
    // --------------------------------------------------------

    float timeSinceEvent =
        max(
            u_time
            -
            u_eventTime,
            0.0
        );


    float eventPulse =
        u_eventStrength
        *
        exp(
            -4.0
            *
            timeSinceEvent
        );


    eventPulse =
        min(
            eventPulse,
            2.5
        );


    // --------------------------------------------------------
    // Coordinate base
    // --------------------------------------------------------

    vec2 p =
        uv
        *
        1.55;


    // Movimento lentissimo:
    // non zoomiamo e non deformiamo brutalmente.
    // Facciamo solo "respirare" il campo.

    p +=
        vec2(
            0.04
            *
            sin(
                u_time
                *
                0.08
            ),

            0.03
            *
            cos(
                u_time
                *
                0.07
            )
        );


    // --------------------------------------------------------
    // Dominio frattale warped
    // --------------------------------------------------------

    vec2 warp =
        warpField(
            p
        );


    float field =
        fbm(
            p
            +
            warp
            *
            3.2
        );


    // Secondo livello:
    // aumenta la complessità senza creare
    // pattern geometrici riconoscibili.

    float detail =
        fbm(
            p
            *
            2.6
            -
            warp
            *
            2.1
        );


    field =
        mix(
            field,
            detail,
            0.35
        );


    // --------------------------------------------------------
    // Cavità
    //
    // Abbassiamo alcune zone per creare "buchi"
    // neri dentro la massa.
    // --------------------------------------------------------

    float cavityNoise =
        fbm(
            p
            *
            1.25
            +
            warp
            *
            1.8
        );


    float cavities =
        smoothstep(
            0.56,
            0.72,
            cavityNoise
        );


    // --------------------------------------------------------
    // Massa
    //
    // Rendiamo il campo più simile a una struttura
    // frattale che a una semplice nuvola.
    // --------------------------------------------------------

    float mass =
        smoothstep(
            0.38,
            0.66,
            field
        );


    mass *=
        1.0
        -
        cavities
        *
        0.88;


    // --------------------------------------------------------
    // Filamenti
    //
    // Creiamo fasce sottili attorno a specifici
    // valori del campo.
    // --------------------------------------------------------

    float filamentA =
        exp(
            -abs(
                field
                -
                0.50
            )
            *
            34.0
        );


    float filamentB =
        exp(
            -abs(
                detail
                -
                0.56
            )
            *
            42.0
        );


    float filaments =
        max(
            filamentA,
            filamentB
            *
            0.75
        );


    filaments *=
        0.35
        +
        mass
        *
        0.65;


    // --------------------------------------------------------
    // Bordo della massa
    //
    // Derivata numerica del campo:
    // dove il valore cambia rapidamente,
    // abbiamo una frontiera.
    // --------------------------------------------------------

    float eps =
        0.0025;


    float fieldX =
        fbm(
            p
            +
            vec2(
                eps,
                0.0
            )
            +
            warp
            *
            3.2
        );


    float fieldY =
        fbm(
            p
            +
            vec2(
                0.0,
                eps
            )
            +
            warp
            *
            3.2
        );


    float gradient =
        length(
            vec2(
                fieldX
                -
                field,

                fieldY
                -
                field
            )
        )
        /
        eps;


    float edge =
        smoothstep(
            0.10,
            1.15,
            gradient
        );


    edge *=
        smoothstep(
            0.25,
            0.85,
            mass
            +
            filaments
        );


    // --------------------------------------------------------
    // Palette
    //
    // Nero
    //   ↓
    // rosso molto scuro
    //   ↓
    // cremisi
    //   ↓
    // rosso vivo
    //   ↓
    // arancio incandescente
    //   ↓
    // bianco caldo sugli eventi
    // --------------------------------------------------------

    vec3 background =
        vec3(
            0.001,
            0.000,
            0.000
        );


    vec3 deepRed =
        vec3(
            0.045,
            0.002,
            0.001
        );


    vec3 crimson =
        vec3(
            0.32,
            0.008,
            0.012
        );


    vec3 red =
        vec3(
            0.78,
            0.025,
            0.015
        );


    vec3 orange =
        vec3(
            1.00,
            0.22,
            0.025
        );


    vec3 hotOrange =
        vec3(
            1.00,
            0.48,
            0.08
        );


    vec3 warmWhite =
        vec3(
            1.00,
            0.86,
            0.62
        );


    vec3 color =
        background;


    // --------------------------------------------------------
    // Corpo
    // --------------------------------------------------------

    vec3 bodyColor =
        mix(
            deepRed,
            crimson,
            field
        );


    bodyColor =
        mix(
            bodyColor,
            red,
            detail
            *
            0.55
        );


    color +=
        bodyColor
        *
        mass
        *
        1.55;


    // --------------------------------------------------------
    // Filamenti
    // --------------------------------------------------------

    float filamentPulse =
        1.0
        +
        eventPulse
        *
        1.35;


    color +=
        red
        *
        filaments
        *
        1.40
        *
        filamentPulse;


    color +=
        orange
        *
        pow(
            filaments,
            2.4
        )
        *
        (
            0.55
            +
            eventPulse
            *
            1.70
        );


    // --------------------------------------------------------
    // Bordo elettrico
    // --------------------------------------------------------

    color +=
        orange
        *
        edge
        *
        (
            0.45
            +
            eventPulse
            *
            1.15
        );


    color +=
        hotOrange
        *
        pow(
            edge,
            3.0
        )
        *
        (
            0.18
            +
            eventPulse
            *
            0.55
        );


    // --------------------------------------------------------
    // Picco luminoso
    //
    // Solo gli eventi più forti portano il bordo
    // verso il bianco caldo.
    // --------------------------------------------------------

    color +=
        warmWhite
        *
        pow(
            edge,
            4.5
        )
        *
        eventPulse
        *
        0.82;


    // --------------------------------------------------------
    // Glow
    // --------------------------------------------------------

    float glow =
        pow(
            max(
                filaments,
                edge
            ),
            0.35
        );


    color +=
        vec3(
            0.55,
            0.018,
            0.003
        )
        *
        glow
        *
        (
            0.12
            +
            eventPulse
            *
            0.18
        );


    // --------------------------------------------------------
    // Cavità più profonde
    // --------------------------------------------------------

    color *=
        1.0
        -
        cavities
        *
        0.72;


    // --------------------------------------------------------
    // Respiro globale leggero
    // --------------------------------------------------------

    float breathing =
        0.96
        +
        0.04
        *
        sin(
            u_time
            *
            0.30
        );


    color *= breathing;


    // --------------------------------------------------------
    // Tone mapping
    // --------------------------------------------------------

    color =
        color
        /
        (
            vec3(1.0)
            +
            color
        );


    // --------------------------------------------------------
    // Gamma
    // --------------------------------------------------------

    color =
        pow(
            max(
                color,
                vec3(0.0)
            ),
            vec3(
                0.78
            )
        );


    fragColor =
        vec4(
            color,
            1.0
        );
}