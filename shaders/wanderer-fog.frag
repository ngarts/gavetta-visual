#version 330

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_eventStrength;
uniform float u_eventTime;

uniform sampler2D u_texture;

out vec4 fragColor;


// ------------------------------------------------------------
// Piccolo noise procedurale.
// Non serve a "muovere" veramente la nebbia:
// serve solo a evitare che il bagliore sembri una maschera piatta.
// ------------------------------------------------------------

float hash21(vec2 p)
{
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);

    return fract(p.x * p.y);
}


float noise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
    );
}


float fbm(vec2 p)
{
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++)
    {
        value += noise(p) * amplitude;

        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}


// ------------------------------------------------------------
// Maschera della nebbia.
//
// Non abbiamo una vera depth map, quindi la ricaviamo
// dall'immagine stessa.
//
// La nebbia tende ad avere:
// - luminosità abbastanza alta
// - saturazione relativamente bassa
// - posizione prevalente nella metà centrale/inferiore
//
// Questo ci permette di reagire soprattutto alle zone nebbiose
// senza illuminare allo stesso modo rocce e viandante.
// ------------------------------------------------------------

float fogMask(vec3 color, vec2 uv)
{
    float brightness =
        dot(
            color,
            vec3(0.299, 0.587, 0.114)
        );

    float maxChannel =
        max(
            color.r,
            max(color.g, color.b)
        );

    float minChannel =
        min(
            color.r,
            min(color.g, color.b)
        );

    float saturation =
        maxChannel - minChannel;


    // Zone luminose.
    float brightMask =
        smoothstep(
            0.32,
            0.82,
            brightness
        );


    // Preferiamo zone poco sature:
    // tipicamente nebbia, foschia e nuvole.
    float lowSaturation =
        1.0 -
        smoothstep(
            0.10,
            0.42,
            saturation
        );


    // Limitiamo un po' il cielo superiore,
    // dove altrimenti potremmo prendere troppe nuvole.
    float verticalMask =
        1.0 -
        smoothstep(
            0.72,
            0.96,
            uv.y
        );


    float mask =
        brightMask
        * lowSaturation
        * verticalMask;


    return clamp(mask, 0.0, 1.0);
}


// ------------------------------------------------------------
// Glow morbido.
//
// Campioniamo alcuni pixel attorno al punto corrente.
// È un piccolo blur locale limitato alla texture.
// ------------------------------------------------------------

vec3 fogBloom(vec2 uv)
{
    vec2 px =
        1.0 / u_resolution;


    vec3 glow = vec3(0.0);

    glow += texture(
        u_texture,
        uv + px * vec2(-4.0,  0.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2( 4.0,  0.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2( 0.0, -4.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2( 0.0,  4.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2(-3.0, -3.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2( 3.0, -3.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2(-3.0,  3.0)
    ).rgb;

    glow += texture(
        u_texture,
        uv + px * vec2( 3.0,  3.0)
    ).rgb;


    return glow / 8.0;
}


// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

void main()
{
    vec2 uv =
        gl_FragCoord.xy /
        u_resolution.xy;


    vec3 original =
        texture(
            u_texture,
            uv
        ).rgb;


    // --------------------------------------------------------
    // Reazione musicale.
    //
    // Ogni evento crea un lampo rapido che poi decade.
    // --------------------------------------------------------

    float timeSinceEvent =
        max(
            u_time - u_eventTime,
            0.0
        );


    float eventPulse =
        u_eventStrength
        * exp(
            -4.2 * timeSinceEvent
        );


    // Evitiamo picchi fuori scala.
    eventPulse =
        min(
            eventPulse,
            2.5
        );


    // --------------------------------------------------------
    // Maschera visiva della nebbia.
    // --------------------------------------------------------

    float fog =
        fogMask(
            original,
            uv
        );


    // --------------------------------------------------------
    // Irregolarità molto lenta.
    //
    // La nebbia non si sposta davvero.
    // Cambia solo leggermente la distribuzione del bagliore.
    // --------------------------------------------------------

    float fogVariation =
        fbm(
            uv * 5.0
            + vec2(
                u_time * 0.025,
                -u_time * 0.012
            )
        );


    fog *=
        mix(
            0.78,
            1.15,
            fogVariation
        );


    // --------------------------------------------------------
    // Bloom.
    // --------------------------------------------------------

    vec3 blurred =
        fogBloom(uv);


    // Luce tendente al bianco caldo.
    vec3 fogLight =
        mix(
            blurred,
            vec3(
                1.0,
                0.88,
                0.76
            ),
            0.48
        );


    float pulseAmount =
        fog
        * eventPulse;


    // --------------------------------------------------------
    // Il vero effetto:
    // la nebbia sembra illuminarsi dall'interno.
    // --------------------------------------------------------

    vec3 color =
        original;


    color +=
        fogLight
        * pulseAmount
        * 0.75;


    // Piccolo innalzamento dell'esposizione locale.
    color *=
        1.0
        + pulseAmount * 0.16;


    // --------------------------------------------------------
    // Glow continuo molto tenue.
    //
    // Anche tra due eventi la nebbia rimane leggermente viva.
    // --------------------------------------------------------

    float breathing =
        0.5
        + 0.5
        * sin(
            u_time * 0.32
        );


    color +=
        fogLight
        * fog
        * breathing
        * 0.035;


    // --------------------------------------------------------
    // Tonemapping semplice.
    // Serve soprattutto quando arrivano eventi molto forti.
    // --------------------------------------------------------

    color =
        color /
        (
            vec3(1.0)
            + color * 0.22
        );


    // Gamma finale.
    color =
        pow(
            color,
            vec3(0.96)
        );


    fragColor =
        vec4(
            color,
            1.0
        );
}