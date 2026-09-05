#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

out vec4 fragColor;


// ============================================================
// COSTANTI
// ============================================================

const float PI     = 3.14159265359;
const float TWO_PI = 6.28318530718;


// ============================================================
// HASH / NOISE
// ============================================================

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
            vec3(p.xyx) * 0.1031
        );

    p3 +=
        dot(
            p3,
            p3.yzx + 33.33
        );

    return fract(
        (p3.x + p3.y) * p3.z
    );
}


float noise2D(vec2 p)
{
    vec2 i =
        floor(p);

    vec2 f =
        fract(p);

    f =
        f * f * (3.0 - 2.0 * f);

    float a =
        hash21(
            i + vec2(0.0, 0.0)
        );

    float b =
        hash21(
            i + vec2(1.0, 0.0)
        );

    float c =
        hash21(
            i + vec2(0.0, 1.0)
        );

    float d =
        hash21(
            i + vec2(1.0, 1.0)
        );

    return
        mix(
            mix(a, b, f.x),
            mix(c, d, f.x),
            f.y
        );
}


float fbm(vec2 p)
{
    float value =
        0.0;

    float amplitude =
        0.5;

    for (int i = 0; i < 5; i++)
    {
        value +=
            noise2D(p)
            * amplitude;

        p *=
            2.03;

        p +=
            vec2(
                7.13,
                3.71
            );

        amplitude *=
            0.5;
    }

    return value;
}


// ============================================================
// ROTAZIONE 2D
// ============================================================

vec2 rotate2D(
    vec2 p,
    float angle
)
{
    float c =
        cos(angle);

    float s =
        sin(angle);

    return vec2(
        c * p.x - s * p.y,
        s * p.x + c * p.y
    );
}


// ============================================================
// FORMA STELLA
// ============================================================

float starShape(
    vec2 p,
    float size
)
{
    float d =
        length(p);

    float core =
        1.0 -
        smoothstep(
            0.0,
            size,
            d
        );


    float crossH =
        exp(
            -abs(p.x)
            * 120.0
        )
        *
        exp(
            -abs(p.y)
            * 16.0
        );


    float crossV =
        exp(
            -abs(p.y)
            * 120.0
        )
        *
        exp(
            -abs(p.x)
            * 16.0
        );


    return
        core * 1.4
        +
        (crossH + crossV)
        * 0.20;
}


// ============================================================
// CAMPO STELLARE NORMALE
// ============================================================

vec3 starField(
    vec2 uv,
    float eventPulse
)
{
    vec3 color =
        vec3(0.0);


    // --------------------------------------------------------
    // stelle lontane
    // --------------------------------------------------------

    vec2 grid1 =
        uv * 34.0;

    vec2 cell1 =
        floor(grid1);

    vec2 local1 =
        fract(grid1)
        - 0.5;

    float rnd1 =
        hash21(cell1);


    if (rnd1 > 0.91)
    {
        vec2 offset =
            vec2(
                hash21(cell1 + 11.7),
                hash21(cell1 + 37.2)
            )
            - 0.5;


        vec2 p =
            local1
            - offset * 0.55;


        float size =
            mix(
                0.018,
                0.050,
                hash21(cell1 + 82.0)
            );


        float twinkle =
            0.55
            +
            0.45
            * sin(
                u_time
                * mix(
                    0.8,
                    2.0,
                    rnd1
                )
                +
                rnd1 * 50.0
            );


        float star =
            starShape(
                p,
                size
            );


        vec3 starColor =
            mix(
                vec3(
                    0.85,
                    0.25,
                    1.0
                ),
                vec3(
                    1.0,
                    0.16,
                    0.38
                ),
                hash21(cell1 + 19.0)
            );


        color +=
            starColor
            * star
            * twinkle
            * 0.55;
    }


    // --------------------------------------------------------
    // stelle medie
    // --------------------------------------------------------

    vec2 grid2 =
        uv * 18.0;

    vec2 cell2 =
        floor(grid2);

    vec2 local2 =
        fract(grid2)
        - 0.5;

    float rnd2 =
        hash21(cell2 + 31.0);


    if (rnd2 > 0.87)
    {
        vec2 offset =
            vec2(
                hash21(cell2 + 51.0),
                hash21(cell2 + 77.0)
            )
            - 0.5;


        vec2 p =
            local2
            - offset * 0.45;


        float size =
            mix(
                0.025,
                0.070,
                hash21(cell2 + 14.0)
            );


        float twinkle =
            0.65
            +
            0.35
            * sin(
                u_time
                * mix(
                    1.0,
                    2.7,
                    rnd2
                )
                +
                rnd2 * 80.0
            );


        float selected =
            step(
                0.70,
                hash21(
                    cell2
                    +
                    floor(
                        u_eventTime * 13.0
                    )
                )
            );


        float eventBoost =
            1.0
            +
            selected
            * eventPulse
            * 2.5;


        float star =
            starShape(
                p,
                size
            );


        vec3 starColor =
            mix(
                vec3(
                    0.95,
                    0.35,
                    1.0
                ),
                vec3(
                    1.0,
                    0.32,
                    0.55
                ),
                hash21(cell2 + 91.0)
            );


        color +=
            starColor
            * star
            * twinkle
            * eventBoost;
    }


    return color;
}


// ============================================================
// STELLE FOREGROUND
//
// Più grandi, più vicine, soprattutto ai bordi.
// Alcune reagiscono agli eventi musicali.
// ============================================================

vec3 foregroundStars(
    vec2 uv,
    float eventPulse
)
{
    vec3 color =
        vec3(0.0);


    vec2 grid =
        uv * 6.0;

    vec2 cell =
        floor(grid);

    vec2 local =
        fract(grid)
        - 0.5;

    float rnd =
        hash21(
            cell + 143.0
        );


    // Preferenza ai bordi orizzontali
    float edgeFactor =
        smoothstep(
            0.45,
            1.20,
            abs(uv.x)
        );


    if (
        rnd > 0.78
        &&
        edgeFactor > 0.02
    )
    {
        vec2 offset =
            vec2(
                hash21(cell + 11.0),
                hash21(cell + 29.0)
            )
            - 0.5;


        vec2 p =
            local
            - offset * 0.55;


        float size =
            mix(
                0.040,
                0.105,
                hash21(cell + 83.0)
            );


        float twinkle =
            0.60
            +
            0.40
            * sin(
                u_time
                * mix(
                    1.4,
                    3.2,
                    rnd
                )
                +
                rnd * 50.0
            );


        float eventSelection =
            hash21(
                cell
                +
                floor(
                    u_eventTime * 17.0
                )
            );


        float selected =
            step(
                0.58,
                eventSelection
            );


        float eventBoost =
            1.0
            +
            selected
            * eventPulse
            * 3.2;


        float star =
            starShape(
                p,
                size
            );


        vec3 starColor =
            mix(
                vec3(
                    0.90,
                    0.30,
                    1.00
                ),
                vec3(
                    1.00,
                    0.18,
                    0.48
                ),
                hash21(cell + 61.0)
            );


        color +=
            starColor
            * star
            * twinkle
            * eventBoost
            * edgeFactor;
    }


    return color;
}


// ============================================================
// NEBULOSA
// ============================================================

vec3 nebula(
    vec2 uv
)
{
    vec2 p =
        uv;


    p =
        rotate2D(
            p,
            -0.55
        );


    p.x *=
        0.65;


    float n1 =
        fbm(
            p * 2.4
            +
            vec2(
                u_time * 0.008,
                0.0
            )
        );


    float n2 =
        fbm(
            p * 5.0
            -
            vec2(
                u_time * 0.004,
                0.0
            )
        );


    float band =
        exp(
            -abs(
                p.y
                +
                0.12
                * sin(p.x * 2.3)
            )
            * 3.0
        );


    float density =
        band
        *
        smoothstep(
            0.35,
            0.82,
            n1
        );


    density *=
        0.5
        +
        0.5 * n2;


    vec3 violet =
        vec3(
            0.22,
            0.01,
            0.32
        );


    vec3 magenta =
        vec3(
            0.55,
            0.015,
            0.24
        );


    vec3 pink =
        vec3(
            0.95,
            0.06,
            0.42
        );


    vec3 col =
        mix(
            violet,
            magenta,
            n1
        );


    col =
        mix(
            col,
            pink,
            pow(n2, 3.0)
        );


    return
        col
        * density
        * 0.75;
}


// ============================================================
// SATURNO
// ============================================================

vec3 renderPlanet(
    vec2 p,
    float eventPulse,
    out float planetMask
)
{
    vec2 center =
        vec2(
            0.18,
            0.03
        );


    vec2 q =
        p - center;


    float radius =
        0.62;


    float d =
        length(q);


    planetMask =
        1.0 -
        smoothstep(
            radius,
            radius + 0.008,
            d
        );


    if (planetMask <= 0.0)
    {
        return vec3(0.0);
    }


    // --------------------------------------------------------
    // falsa sfera 3D
    // --------------------------------------------------------

    vec2 sphereUV =
        q / radius;


    float z =
        sqrt(
            max(
                0.0,
                1.0
                -
                dot(
                    sphereUV,
                    sphereUV
                )
            )
        );


    vec3 normal =
        normalize(
            vec3(
                sphereUV.x,
                sphereUV.y,
                z
            )
        );


    float longitude =
        atan(
            normal.x,
            normal.z
        );


    float latitude =
        asin(
            normal.y
        );


    // --------------------------------------------------------
    // bande atmosferiche
    // --------------------------------------------------------

    float bands1 =
        sin(
            latitude * 28.0
            +
            1.5
            * sin(
                longitude * 2.0
                +
                u_time * 0.06
            )
        );


    float bands2 =
        sin(
            latitude * 63.0
            +
            0.7
            * sin(
                longitude * 5.0
            )
        );


    float turbulence =
        fbm(
            vec2(
                longitude * 3.0
                +
                u_time * 0.008,
                latitude * 10.0
            )
        );


    float pattern =
        0.5
        +
        0.22 * bands1
        +
        0.10 * bands2
        +
        0.22 * turbulence;


    // --------------------------------------------------------
    // palette
    // --------------------------------------------------------

    vec3 deepViolet =
        vec3(
            0.06,
            0.004,
            0.10
        );


    vec3 violet =
        vec3(
            0.30,
            0.025,
            0.42
        );


    vec3 magenta =
        vec3(
            0.72,
            0.02,
            0.34
        );


    vec3 hotPink =
        vec3(
            1.00,
            0.12,
            0.48
        );


    vec3 surfaceColor =
        mix(
            deepViolet,
            violet,
            smoothstep(
                0.15,
                0.55,
                pattern
            )
        );


    surfaceColor =
        mix(
            surfaceColor,
            magenta,
            smoothstep(
                0.48,
                0.92,
                pattern
            )
        );


    // --------------------------------------------------------
    // illuminazione
    // --------------------------------------------------------

    vec3 lightDir =
        normalize(
            vec3(
                -0.75,
                0.45,
                0.8
            )
        );


    float diffuse =
        max(
            dot(
                normal,
                lightDir
            ),
            0.0
        );


    float rim =
        pow(
            1.0
            -
            max(
                normal.z,
                0.0
            ),
            2.5
        );


    float fresnel =
        pow(
            1.0
            -
            max(
                normal.z,
                0.0
            ),
            4.0
        );


    vec3 color =
        surfaceColor
        *
        (
            0.16
            +
            diffuse * 0.85
        );


    // --------------------------------------------------------
    // Glass interno, ma meno trasparente di prima
    // --------------------------------------------------------

    float internalGlow =
        pow(
            max(
                0.0,
                1.0
                -
                d / radius
            ),
            2.5
        );


    color +=
        violet
        * internalGlow
        * 0.18;


    // superficie leggermente più piena
    color +=
        surfaceColor
        * 0.18;


    // --------------------------------------------------------
    // bordo glass
    // --------------------------------------------------------

    color +=
        hotPink
        * rim
        * 1.15;


    color +=
        vec3(
            0.8,
            0.15,
            1.0
        )
        * fresnel
        * 0.65;


    // --------------------------------------------------------
    // reazione all'evento
    // --------------------------------------------------------

    color +=
        hotPink
        * rim
        * eventPulse
        * 0.95;


    return
        color
        * planetMask;
}


// ============================================================
// ANELLI
// ============================================================

vec3 renderRings(
    vec2 uv,
    float eventPulse,
    out float ringMask
)
{
    vec2 center =
        vec2(
            0.18,
            0.03
        );


    vec2 p =
        uv - center;


    p =
        rotate2D(
            p,
            -0.28
        );


    vec2 ringUV =
        vec2(
            p.x,
            p.y / 0.23
        );


    float r =
        length(
            ringUV
        );


    float innerRadius =
        0.78;


    float outerRadius =
        1.33;


    float innerMask =
        smoothstep(
            innerRadius,
            innerRadius + 0.012,
            r
        );


    float outerMask =
        1.0 -
        smoothstep(
            outerRadius - 0.012,
            outerRadius,
            r
        );


    ringMask =
        innerMask
        * outerMask;


    if (ringMask <= 0.0)
    {
        return vec3(0.0);
    }


    float radial =
        (r - innerRadius)
        /
        (
            outerRadius
            -
            innerRadius
        );


    float stripes1 =
        0.5
        +
        0.5
        * sin(
            radial * 120.0
        );


    float stripes2 =
        0.5
        +
        0.5
        * sin(
            radial * 247.0
            +
            1.3
        );


    float noise =
        noise2D(
            vec2(
                radial * 80.0,
                atan(
                    ringUV.y,
                    ringUV.x
                )
                * 5.0
            )
        );


    float stripePattern =
        stripes1 * 0.55
        +
        stripes2 * 0.25
        +
        noise * 0.20;


    float highlight =
        pow(
            stripePattern,
            3.0
        );


    vec3 violet =
        vec3(
            0.28,
            0.02,
            0.50
        );


    vec3 magenta =
        vec3(
            0.75,
            0.015,
            0.38
        );


    vec3 pink =
        vec3(
            1.0,
            0.20,
            0.65
        );


    vec3 color =
        mix(
            violet,
            magenta,
            stripePattern
        );


    color +=
        pink
        * highlight
        * 1.3;


    float edgeInner =
        exp(
            -abs(
                r - innerRadius
            )
            * 90.0
        );


    float edgeOuter =
        exp(
            -abs(
                r - outerRadius
            )
            * 90.0
        );


    color +=
        pink
        *
        (
            edgeInner
            +
            edgeOuter
        )
        * 1.4;


    // --------------------------------------------------------
    // impulso lungo gli anelli
    // --------------------------------------------------------

    float angle =
        atan(
            ringUV.y,
            ringUV.x
        );


    float movingPulse =
        exp(
            -pow(
                sin(
                    angle
                    -
                    u_time * 0.85
                ),
                2.0
            )
            * 13.0
        );


    color +=
        pink
        * movingPulse
        *
        (
            0.20
            +
            eventPulse * 1.4
        );


    return
        color
        * ringMask;
}


// ============================================================
// MAIN
// ============================================================

void main()
{
    vec2 uv =
        (
            2.0 * gl_FragCoord.xy
            -
            u_resolution.xy
        )
        /
        u_resolution.y;


    // --------------------------------------------------------
    // movimento camera lentissimo
    // --------------------------------------------------------

    uv +=
        vec2(
            sin(
                u_time * 0.035
            ),
            cos(
                u_time * 0.028
            )
        )
        * 0.015;


    // --------------------------------------------------------
    // evento musicale
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
            -5.0
            * timeSinceEvent
        );


    // --------------------------------------------------------
    // sfondo
    // --------------------------------------------------------

    vec3 color =
        vec3(
            0.0015,
            0.0002,
            0.004
        );


    color +=
        nebula(
            uv * 0.85
            +
            vec2(
                -0.20,
                0.08
            )
        );


    // stelle lontane / medie
    color +=
        starField(
            uv,
            eventPulse
        );


    // stelle grandi ai bordi
    color +=
        foregroundStars(
            uv,
            eventPulse
        );


    // --------------------------------------------------------
    // Saturno
    // --------------------------------------------------------

    float planetMask;


    vec3 planet =
        renderPlanet(
            uv,
            eventPulse,
            planetMask
        );


    // --------------------------------------------------------
    // anelli
    // --------------------------------------------------------

    float ringMask;


    vec3 rings =
        renderRings(
            uv,
            eventPulse,
            ringMask
        );


    // --------------------------------------------------------
    // ordine fronte / retro
    // --------------------------------------------------------

    vec2 planetCenter =
        vec2(
            0.18,
            0.03
        );


    vec2 rp =
        uv
        -
        planetCenter;


    rp =
        rotate2D(
            rp,
            -0.28
        );


    float frontSide =
        smoothstep(
            -0.03,
            0.03,
            -rp.y
        );


    float backSide =
        1.0
        -
        frontSide;


    // anello dietro
    color +=
        rings
        * backSide
        * (
            1.0
            -
            planetMask
        );


    // pianeta
    color +=
        planet;


    // anello davanti
    color +=
        rings
        * frontSide;


    // --------------------------------------------------------
    // atmosfera
    // --------------------------------------------------------

    vec2 planetP =
        uv
        -
        planetCenter;


    float planetDistance =
        length(
            planetP
        );


    float atmosphere =
        exp(
            -abs(
                planetDistance
                -
                0.62
            )
            * 24.0
        );


    color +=
        vec3(
            0.82,
            0.05,
            0.52
        )
        * atmosphere
        *
        (
            0.18
            +
            eventPulse * 0.16
        );


    // --------------------------------------------------------
    // vignettatura
    // --------------------------------------------------------

    float vignette =
        1.0
        -
        smoothstep(
            0.65,
            1.75,
            length(uv)
        );


    color *=
        0.72
        +
        vignette * 0.28;


    // --------------------------------------------------------
    // tone mapping
    // --------------------------------------------------------

    color =
        1.0
        -
        exp(
            -color * 1.15
        );


    fragColor =
        vec4(
            color,
            1.0
        );
}