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
// ROTAZIONE
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

    return
        mat2(
            c, -s,
            s,  c
        )
        * p;
}


// ============================================================
// STELLA
// ============================================================

float starShape(
    vec2 p,
    float size
)
{
    float d =
        length(p);


    float core =
        exp(
            -d
            * d
            /
            (
                size
                * size
            )
        );


    float rayX =
        exp(
            -abs(p.x)
            /
            (
                size * 0.16
            )
        )
        *
        exp(
            -abs(p.y)
            /
            (
                size * 2.8
            )
        );


    float rayY =
        exp(
            -abs(p.y)
            /
            (
                size * 0.16
            )
        )
        *
        exp(
            -abs(p.x)
            /
            (
                size * 2.8
            )
        );


    return
        core
        +
        0.40
        *
        (
            rayX
            +
            rayY
        );
}


// ============================================================
// CAMPO STELLARE
// ============================================================

vec3 starField(
    vec2 uv,
    float eventPulse
)
{
    vec3 color =
        vec3(0.0);


    vec2 grid1 =
        uv * 32.0;

    vec2 cell1 =
        floor(grid1);

    vec2 local1 =
        fract(grid1)
        - 0.5;

    float rnd1 =
        hash21(cell1);


    if (rnd1 > 0.82)
    {
        vec2 offset =
            vec2(
                hash21(cell1 + 2.0),
                hash21(cell1 + 7.0)
            )
            - 0.5;


        vec2 p =
            local1
            - offset * 0.55;


        float size =
            mix(
                0.015,
                0.040,
                hash21(cell1 + 9.0)
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
                    0.55,
                    0.72,
                    1.00
                ),
                vec3(
                    0.30,
                    0.55,
                    1.00
                ),
                hash21(cell1 + 19.0)
            );


        color +=
            starColor
            * star
            * twinkle
            * 0.55;
    }


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
                    0.72,
                    0.84,
                    1.00
                ),
                vec3(
                    0.38,
                    0.66,
                    1.00
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
                    0.68,
                    0.80,
                    1.00
                ),
                vec3(
                    0.26,
                    0.58,
                    1.00
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


    vec3 deepBlue =
        vec3(
            0.008,
            0.025,
            0.12
        );


    vec3 indigo =
        vec3(
            0.025,
            0.10,
            0.34
        );


    vec3 iceBlue =
        vec3(
            0.16,
            0.42,
            0.82
        );


    vec3 col =
        mix(
            deepBlue,
            indigo,
            n1
        );


    col =
        mix(
            col,
            iceBlue,
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


    vec3 deepNavy =
        vec3(
            0.006,
            0.012,
            0.055
        );


    vec3 indigo =
        vec3(
            0.025,
            0.075,
            0.25
        );


    vec3 cobalt =
        vec3(
            0.035,
            0.20,
            0.58
        );


    vec3 iceBlue =
        vec3(
            0.30,
            0.72,
            1.00
        );


    vec3 surfaceColor =
        mix(
            deepNavy,
            indigo,
            smoothstep(
                0.15,
                0.55,
                pattern
            )
        );


    surfaceColor =
        mix(
            surfaceColor,
            cobalt,
            smoothstep(
                0.48,
                0.92,
                pattern
            )
        );


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
            2.2
        );


    float atmosphericDepth =
        smoothstep(
            0.0,
            1.0,
            z
        );


    float bandContrast =
        smoothstep(
            0.25,
            0.80,
            pattern
        );


    vec3 shadowColor =
        vec3(
            0.003,
            0.008,
            0.028
        );


    vec3 litSurface =
        mix(
            shadowColor,
            surfaceColor,
            0.35 + diffuse * 0.65
        );


    litSurface *=
        0.78
        +
        bandContrast * 0.38;


    vec3 atmosphericColor =
        mix(
            vec3(
                0.015,
                0.055,
                0.18
            ),
            iceBlue,
            pattern * 0.45
        );


    vec3 color =
        litSurface
        *
        (
            0.45
            +
            atmosphericDepth * 0.55
        );


    color +=
        atmosphericColor
        * diffuse
        * turbulence
        * 0.18;


    color +=
        iceBlue
        * rim
        * 0.55;


    color +=
        vec3(
            0.16,
            0.42,
            0.88
        )
        * pow(rim, 2.0)
        * 0.22;


    color +=
        iceBlue
        * rim
        * eventPulse
        * 0.48;


    color +=
        surfaceColor
        * bandContrast
        * eventPulse
        * 0.10;


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


    vec3 darkDust =
        vec3(
            0.025,
            0.040,
            0.085
        );


    vec3 indigoDust =
        vec3(
            0.070,
            0.150,
            0.300
        );


    vec3 silverDust =
        vec3(
            0.46,
            0.60,
            0.78
        );


    vec3 color =
        mix(
            darkDust,
            indigoDust,
            stripePattern
        );


    color =
        mix(
            color,
            silverDust,
            highlight * 0.55
        );


    color *=
        0.55
        +
        stripePattern * 0.70;


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
        silverDust
        *
        (
            edgeInner
            +
            edgeOuter
        )
        * 0.42;


    float ringResponse =
        0.18
        +
        eventPulse * 0.42;


    color +=
        silverDust
        * highlight
        * ringResponse;


    return
        color
        * ringMask;
}


// ============================================================
// PICCOLA SFERA ROSSA IN ORBITA
//
// Richiamo visivo alla sfera di impact-sphere.frag.
//
// La sfera segue la stessa ellisse degli anelli.
// Non reagisce agli eventi musicali: il suo movimento è continuo.
// ============================================================

vec3 renderOrbitSphere(
    vec2 uv,
    out float sphereMask,
    out float sphereFrontSide
)
{
    vec2 planetCenter =
        vec2(
            0.18,
            0.03
        );


    // --------------------------------------------------------
    // orbita
    //
    // Valore compreso all'interno della fascia degli anelli.
    // --------------------------------------------------------

    float orbitRadius =
        1.04;


    // --------------------------------------------------------
    // movimento antiorario
    //
    // Il segno positivo produce rotazione antioraria
    // nel sistema locale degli anelli.
    // --------------------------------------------------------

    float orbitAngle =
        u_time * 0.32;


    // posizione nel sistema "circolare" degli anelli
    vec2 orbitPoint =
        vec2(
            cos(orbitAngle) * orbitRadius,
            sin(orbitAngle) * orbitRadius
        );


    // schiacciamento verticale:
    // lo stesso rapporto usato dagli anelli
    vec2 localEllipsePoint =
        vec2(
            orbitPoint.x,
            orbitPoint.y * 0.23
        );


    // riportiamo l'ellisse alla rotazione visiva degli anelli
    vec2 sphereCenter =
        planetCenter
        +
        rotate2D(
            localEllipsePoint,
            0.28
        );


    // --------------------------------------------------------
    // dimensione
    // --------------------------------------------------------

    float sphereRadius =
        0.034;


    vec2 q =
        uv
        -
        sphereCenter;


    float d =
        length(q);


    sphereMask =
        1.0
        -
        smoothstep(
            sphereRadius,
            sphereRadius + 0.004,
            d
        );


    if (sphereMask <= 0.0)
    {
        sphereFrontSide = 0.0;
        return vec3(0.0);
    }


    // --------------------------------------------------------
    // falso volume 3D
    // --------------------------------------------------------

    vec2 sphereUV =
        q / sphereRadius;


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
                sphereUV,
                z
            )
        );


    vec3 lightDir =
        normalize(
            vec3(
                -0.65,
                0.55,
                0.85
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
            2.4
        );


    // --------------------------------------------------------
    // materiale rosso
    // --------------------------------------------------------

    vec3 deepRed =
        vec3(
            0.12,
            0.002,
            0.004
        );


    vec3 red =
        vec3(
            0.88,
            0.015,
            0.025
        );


    vec3 hotRed =
        vec3(
            1.00,
            0.18,
            0.12
        );


    vec3 color =
        mix(
            deepRed,
            red,
            0.25
            +
            diffuse * 0.75
        );


    color +=
        hotRed
        * pow(diffuse, 8.0)
        * 0.55;


    color +=
        red
        * rim
        * 0.35;


    // --------------------------------------------------------
    // fronte / retro
    //
    // L'orbita in coordinate circolari conserva il segno di Y:
    // la metà inferiore corrisponde alla parte frontale degli anelli.
    // --------------------------------------------------------

    sphereFrontSide =
        smoothstep(
            -0.03,
            0.03,
            -orbitPoint.y
        );


    return
        color
        * sphereMask;
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
            0.0002,
            0.0012,
            0.0045
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


    color +=
        starField(
            uv,
            eventPulse
        );


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
    // piccola sfera rossa
    // --------------------------------------------------------

    float orbitSphereMask;
    float orbitSphereFrontSide;


    vec3 orbitSphere =
        renderOrbitSphere(
            uv,
            orbitSphereMask,
            orbitSphereFrontSide
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


    // --------------------------------------------------------
    // metà posteriore degli anelli
    // --------------------------------------------------------

    color +=
        rings
        * backSide
        * (
            1.0
            -
            planetMask
        );

    // --------------------------------------------------------
    // pianeta
    // --------------------------------------------------------

    color +=
        planet;


    // --------------------------------------------------------
    // metà frontale degli anelli
    // --------------------------------------------------------

    color +=
        rings
        * frontSide;

    // --------------------------------------------------------
    // sfera rossa appoggiata sopra gli anelli
    //
    // La sfera viene disegnata dopo entrambi i lati degli anelli,
    // quindi le linee non possono attraversarla.
    //
    // Quando passa nella metà posteriore dell'orbita continua
    // però a essere nascosta dal pianeta.
    // --------------------------------------------------------

    float sphereVisibility =
        orbitSphereFrontSide
        +
        (
            1.0
            -
            orbitSphereFrontSide
        )
        *
        (
            1.0
            -
            planetMask
        );

    // --------------------------------------------------------
    // compositing opaco della sfera
    //
    // orbitSphere contiene già sphereMask moltiplicata al colore.
    // Recuperiamo il materiale originale della sfera e lo
    // sovrapponiamo realmente a ciò che c'è sotto.
    //
    // Così le linee degli anelli NON possono più attraversarla.
    // --------------------------------------------------------

    float sphereAlpha =
        orbitSphereMask
        * sphereVisibility;


    vec3 sphereSurface =
        orbitSphere
        /
        max(
            orbitSphereMask,
            0.00001
        );


    color =
        mix(
            color,
            sphereSurface,
            sphereAlpha
        );

    // --------------------------------------------------------
    // piccolo alone rosso
    //
    // Compare soltanto quando la sfera è visibile.
    // --------------------------------------------------------

    vec2 orbitLocalPoint =
        vec2(
            cos(u_time * 0.32) * 1.04,
            sin(u_time * 0.32) * 1.04 * 0.23
        );


    vec2 orbitScreenPoint =
        planetCenter
        +
        rotate2D(
            orbitLocalPoint,
            0.28
        );


    float orbitGlow =
        exp(
            -length(
                uv
                -
                orbitScreenPoint
            )
            * 48.0
        );

    color +=
        vec3(
            0.55,
            0.006,
            0.012
        )
        * orbitGlow
        * sphereVisibility
        * 0.18;


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
            0.12,
            0.46,
            1.00
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