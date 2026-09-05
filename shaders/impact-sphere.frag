#version 330

// ============================================================
// UNIFORM
// ============================================================

// Dimensione della viewport
uniform vec2 u_resolution;

// Tempo trascorso dall'avvio dello shader
uniform float u_time;

/*
 * Parametri dell'impatto.
 *
 * Questi uniform saranno usati più avanti dal sistema esterno
 * che analizzerà la musica.
 *
 * u_hitDir      = direzione della forza del colpo
 * u_hitPos      = posizione del colpo sulla superficie
 * u_hitStrength = intensità del colpo
 * u_hitTime     = tempo trascorso dall'ultimo impatto
 *
 * Per ora nel main usiamo valori fissi per fare i test.
 */
uniform vec3 u_hitDir;
uniform vec3 u_hitPos;
uniform float u_hitStrength;
uniform float u_hitTime;

out vec4 fragColor;

// ============================================================
// HASH / NOISE
// ============================================================

float hash31(vec3 p)
{
    p = fract(
        p * 0.1031
    );

    p += dot(
        p,
        p.yzx + 33.33
    );

    return fract(
        (p.x + p.y) * p.z
    );
}


float valueNoise(vec3 p)
{
    vec3 i = floor(p);
    vec3 f = fract(p);

    // Interpolazione morbida
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));

    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(
        nxy0,
        nxy1,
        f.z
    );
}


// ============================================================
// FBM
//
// Combina più frequenze di noise.
// Serve per ottenere una grana meno artificiale.
// ============================================================

float fbm(vec3 p)
{
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++)
    {
        value += (
            amplitude *
            valueNoise(p)
        );

        p *= 2.03;
        amplitude *= 0.5;
    }

    return value;
}

// ============================================================
// LEATHER GRAIN
//
// Restituisce una variazione fine della superficie.
// Non modifica la silhouette della sfera.
// ============================================================

float getLeatherGrain(vec3 p)
{
    float largeGrain =
        fbm(
            p * 18.0
        );

    float fineGrain =
        fbm(
            p * 65.0
        );

    return (
        0.65 * largeGrain +
        0.35 * fineGrain
    );
}

// ============================================================
// SPHERICAL COORDINATES
// ============================================================

vec2 getSphericalUV(vec3 p)
{
    vec3 n = normalize(p);

    float longitude =
        atan(n.z, n.x);

    float latitude =
        asin(
            clamp(
                n.y,
                -1.0,
                1.0
            )
        );

    return vec2(
        longitude,
        latitude
    );
}

float getSeamBand(
    float coordinate,
    float center,
    float width
)
{
    return 1.0 -
        smoothstep(
            width,
            width * 1.6,
            abs(
                coordinate - center
            )
        );
}

// ============================================================
// LEATHER SEAM
//
// Costruisce una doppia cucitura curva sulla superficie.
// La cucitura segue la longitudine della sfera.
// ============================================================

float getLeatherSeam(vec3 p)
{
    vec2 spherical =
        getSphericalUV(p);

    float longitude =
        spherical.x;

    float latitude =
        spherical.y;

    /*
     * Centro della parte visibile della sfera.
     * La camera si trova sul lato -Z.
     */
    float frontLongitude =
        -1.57079632679;

    /*
     * Piccola curvatura naturale.
     */
    float curve =
        0.10 *
        sin(
            latitude * 2.6
        );

    float seamCoordinate =
        longitude -
        frontLongitude -
        curve;

    /*
     * Posizione e dimensione delle due cuciture.
     */
    float seamOffset =
        0.48;

    float seamWidth =
        0.030;

    float leftSeam =
        getSeamBand(
            seamCoordinate,
            -seamOffset,
            seamWidth
        );

    float rightSeam =
        getSeamBand(
            seamCoordinate,
            seamOffset,
            seamWidth
        );

    return max(
        leftSeam,
        rightSeam
    );
}

// ============================================================
// STITCHES
//
// Crea piccoli punti trasversali ripetuti
// tra le due linee principali.
// ============================================================

float getLeatherStitches(vec3 p)
{
    vec2 spherical =
        getSphericalUV(p);

    float longitude =
        spherical.x;

    float latitude =
        spherical.y;

    float frontLongitude =
        -1.57079632679;

    float curve =
        0.10 *
        sin(
            latitude * 2.6
        );

    float seamCoordinate =
        longitude -
        frontLongitude -
        curve;

    float seamOffset =
        0.48;

    /*
     * Zona di influenza intorno
     * alle due cuciture.
     */
    float stitchZoneWidth =
        0.075;

    float leftZone =
        1.0 -
        smoothstep(
            stitchZoneWidth,
            stitchZoneWidth * 1.4,
            abs(
                seamCoordinate +
                seamOffset
            )
        );

    float rightZone =
        1.0 -
        smoothstep(
            stitchZoneWidth,
            stitchZoneWidth * 1.4,
            abs(
                seamCoordinate -
                seamOffset
            )
        );

    float zone =
        max(
            leftZone,
            rightZone
        );

    /*
     * Ripetizione verticale dei punti.
     */
    float repeat =
        fract(
            (
                latitude +
                1.57079632679
            ) * 10.5
        );

    float stitch =
        1.0 -
        smoothstep(
            0.18,
            0.32,
            abs(
                repeat - 0.5
            )
        );

    /*
     * Leggera variazione casuale:
     * evita che tutti i punti sembrino
     * identici e perfettamente industriali.
     */
    float variation =
        0.82 +
        0.18 *
        hash31(
            vec3(
                floor(
                    (
                        latitude +
                        1.57079632679
                    ) * 10.5
                ),
                seamCoordinate * 10.0,
                0.0
            )
        );

    return (
        zone *
        stitch *
        variation
    );
}

// ============================================================
// GEOMETRIA - SFERA MORBIDA DEFORMABILE
// ============================================================

/*
 * Signed Distance Function della sfera deformabile.
 *
 * p            = punto dello spazio che stiamo valutando
 * center       = centro corrente della sfera
 * radius       = raggio della sfera
 * tHit         = tempo trascorso dall'ultimo impatto
 * hitDir       = direzione della forza
 * hitPos       = posizione dell'impatto sulla sfera
 * dentStrength = profondità corrente della deformazione
 *
 * La funzione restituisce:
 *
 *   d < 0  -> punto interno alla superficie
 *   d = 0  -> punto sulla superficie
 *   d > 0  -> punto esterno alla superficie
 */
float sdSoftSphere(
    vec3 p,
    vec3 center,
    float radius,
    float tHit,
    vec3 hitDir,
    vec3 hitPos,
    float dentStrength
)
{
    // Coordinate locali rispetto al centro della sfera
    vec3 q = p - center;


    // --------------------------------------------------------
    // Punto d'impatto
    // --------------------------------------------------------

    /*
     * hitPos descrive una direzione dal centro della sfera.
     * Normalizzandola e moltiplicandola per radius otteniamo
     * un punto sulla superficie.
     */
    vec3 impactPoint =
        normalize(hitPos) * radius;

    // Coordinate relative al punto in cui arriva il pugno
    vec3 rel =
        q - impactPoint;


    // --------------------------------------------------------
    // Asse del pugno
    // --------------------------------------------------------

    /*
     * Proiezione di rel lungo la direzione del colpo.
     *
     * axial indica quanto il punto si trova lungo l'asse
     * della forza.
     */
    float axial =
        dot(rel, hitDir);

    vec3 parallel =
        hitDir * axial;

    /*
     * Componente perpendicolare all'asse del pugno.
     *
     * La sua lunghezza rappresenta la distanza laterale
     * rispetto al centro della zona colpita.
     */
    vec3 perpendicular =
        rel - parallel;

    float radial =
        length(perpendicular);


    // --------------------------------------------------------
    // Zona compressa dal pugno
    // --------------------------------------------------------

    /*
     * Maschera radiale.
     *
     * Vale circa 1 vicino all'asse del pugno e decade
     * progressivamente allontanandosi.
     */
    float radialMask =
        exp(-4.0 * radial * radial);

    /*
     * Maschera di profondità.
     *
     * Impedisce alla deformazione di attraversare
     * indiscriminatamente tutta la sfera.
     */
    float depthMask =
        exp(-2.5 * axial * axial);

    float impactMask =
        radialMask * depthMask;

    /*
     * Compressione principale della sfera.
     */
    float compression =
        dentStrength * impactMask;


    // --------------------------------------------------------
    // Increspature della pelle durante l'impatto
    // --------------------------------------------------------

    /*
     * Piccola irregolarità per evitare increspature
     * perfettamente concentriche e artificiali.
     */
    float irregularity =
        sin(
            perpendicular.x * 18.0 +
            perpendicular.y * 13.0
        ) * 0.15;

    /*
     * Onde concentriche attorno alla zona d'impatto.
     *
     * sin() crea l'alternanza delle pieghe.
     * exp() le attenua allontanandosi dal pugno.
     */
    float wrinkles =
        sin(radial * 35.0 + irregularity) *
        exp(-6.0 * radial);

    /*
     * Le increspature sono più evidenti subito dopo il colpo
     * e scompaiono rapidamente.
     */
    float wrinkleStrength =
        0.03 * exp(-5.0 * tHit);


    // --------------------------------------------------------
    // Deformazione effettiva delle coordinate
    // --------------------------------------------------------

    // Compressione principale
    q -= hitDir * compression;

    // Increspature locali
    q -= hitDir *
         wrinkles *
         wrinkleStrength *
         depthMask;


    // SDF finale della sfera deformata
    return length(q) - radius;
}


// ============================================================
// NORMALE DELLA SUPERFICIE
// ============================================================

/*
 * Calcola la normale numericamente usando il gradiente
 * della stessa SDF utilizzata dal ray marching.
 *
 * Campioniamo la distanza poco prima e poco dopo il punto
 * lungo X, Y e Z.
 *
 * Questo permette alle luci di seguire correttamente anche
 * ammaccature e increspature.
 */
vec3 getNormal(
    vec3 p,
    vec3 center,
    float radius,
    float tHit,
    vec3 hitDir,
    vec3 hitPos,
    float dentStrength
)
{
    float e = 0.001;

    float dx =
        sdSoftSphere(
            p + vec3(e, 0.0, 0.0),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        )
        -
        sdSoftSphere(
            p - vec3(e, 0.0, 0.0),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        );

    float dy =
        sdSoftSphere(
            p + vec3(0.0, e, 0.0),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        )
        -
        sdSoftSphere(
            p - vec3(0.0, e, 0.0),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        );

    float dz =
        sdSoftSphere(
            p + vec3(0.0, 0.0, e),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        )
        -
        sdSoftSphere(
            p - vec3(0.0, 0.0, e),
            center,
            radius,
            tHit,
            hitDir,
            hitPos,
            dentStrength
        );

    return normalize(vec3(dx, dy, dz));
}


// ============================================================
// SFONDO
// ============================================================

/*
 * Gradiente radiale molto morbido.
 *
 * Il centro è leggermente spostato per evitare un fondale
 * perfettamente simmetrico.
 *
 * Non influenza in alcun modo l'illuminazione della sfera:
 * viene semplicemente usato per i pixel in cui il ray
 * non incontra la geometria.
 */
vec3 getBackground(vec2 uv)
{
    vec2 bgCenter =
        vec2(0.05, 0.0);

    float distanceFromCenter =
        length(uv - bgCenter);

    float gradient =
        exp(
            -2.5 *
            distanceFromCenter *
            distanceFromCenter
        );

    vec3 backgroundColor =
        vec3(0.40, 0.28, 0.48);

    return backgroundColor * gradient;
}


// ============================================================
// MATERIALE E ILLUMINAZIONE DELLA SFERA
// ============================================================

vec3 getLeatherNormal(
    vec3 p,
    vec3 normal
)
{
    vec3 n =
        normal;

    float e =
        0.003;


    // --------------------------------------------------------
    // MICRO-GRANA DELLA PELLE
    // --------------------------------------------------------

    float center =
        getLeatherGrain(p);

    float grainX =
        getLeatherGrain(
            p + vec3(e, 0.0, 0.0)
        );

    float grainY =
        getLeatherGrain(
            p + vec3(0.0, e, 0.0)
        );

    float grainZ =
        getLeatherGrain(
            p + vec3(0.0, 0.0, e)
        );

    vec3 grainGradient =
        vec3(
            grainX - center,
            grainY - center,
            grainZ - center
        );

    /*
     * La grana deve essere percepibile
     * ma non trasformare la superficie
     * in pietra.
     */
    n +=
        grainGradient *
        2.2;


    // --------------------------------------------------------
    // RILIEVO DELLE CUCITURE
    // --------------------------------------------------------

    float seam =
        getLeatherSeam(p);

    float stitches =
        getLeatherStitches(p);

    /*
     * I bordi principali sono un rilievo morbido.
     * Il filo è leggermente più pronunciato.
     */
    float seamHeight =
        seam * 0.65 +
        stitches * 1.10;


    float seamHeightX =
        getLeatherSeam(
            p + vec3(e, 0.0, 0.0)
        ) * 0.65 +
        getLeatherStitches(
            p + vec3(e, 0.0, 0.0)
        ) * 1.10;

    float seamHeightY =
        getLeatherSeam(
            p + vec3(0.0, e, 0.0)
        ) * 0.65 +
        getLeatherStitches(
            p + vec3(0.0, e, 0.0)
        ) * 1.10;

    float seamHeightZ =
        getLeatherSeam(
            p + vec3(0.0, 0.0, e)
        ) * 0.65 +
        getLeatherStitches(
            p + vec3(0.0, 0.0, e)
        ) * 1.10;


    vec3 seamGradient =
        vec3(
            seamHeightX - seamHeight,
            seamHeightY - seamHeight,
            seamHeightZ - seamHeight
        );

    /*
     * Il rilievo modifica soltanto
     * l'illuminazione, non la SDF.
     */
    n +=
        seamGradient *
        3.5;


    return normalize(n);
}

/*
 * Illuminazione molto semplice:
 *
 * ambient + Lambert diffuse
 *
 * La sorgente luminosa si trova nella stessa zona
 * della camera, davanti alla sfera.
 *
 * Più avanti qui potremo aggiungere:
 * - riflesso speculare
 * - grana della pelle
 * - variazioni del colore
 * - roughness
 */
vec3 shadeSphere(
    vec3 hitPoint,
    vec3 sphereCenter,
    vec3 normal
)
{

    /*
    * Coordinate locali della superficie.
    *
    * Pelle e cuciture devono muoversi insieme
    * alla sfera e non restare ancorate
    * allo spazio della scena.
    */
    vec3 localPoint =
        hitPoint -
        sphereCenter;

    // --------------------------------------------------------
    // Illuminazione
    // --------------------------------------------------------

    vec3 leatherNormal =
    getLeatherNormal(
        localPoint,
        normal
    );

    vec3 lightPos =
        vec3(
            -2.0,
            2.5,
            -3.0
        );

    vec3 lightDir =
        normalize(
            lightPos - hitPoint
        );

    vec3 viewDir =
        normalize(
            vec3(0.0, 0.0, -3.0) -
            hitPoint
        );


    // --------------------------------------------------------
    // Pelle procedurale
    // --------------------------------------------------------

    float leather =
        getLeatherGrain(
            localPoint
        );

    /*
     * Rosso di base molto profondo.
     */
    vec3 darkLeather =
        vec3(
            0.22,
            0.008,
            0.006
        );

    vec3 redLeather =
        vec3(
            0.72,
            0.025,
            0.018
        );

    vec3 baseColor =
        mix(
            darkLeather,
            redLeather,
            leather
        );


    // --------------------------------------------------------
    // Cuciture
    // --------------------------------------------------------

    float seam =
        getLeatherSeam(
            localPoint
        );

    float stitches =
        getLeatherStitches(
            localPoint
        );

    vec3 seamColor =
        vec3(
            0.055,
            0.008,
            0.006
        );

    baseColor =
        mix(
            baseColor,
            seamColor,
            seam * 0.92
        );

    vec3 threadColor =
        vec3(
            0.28,
            0.12,
            0.075
        );

    baseColor =
        mix(
            baseColor,
            threadColor,
            stitches * 0.70
        );
        


    // --------------------------------------------------------
    // Diffuse
    // --------------------------------------------------------

    float diffuse =
        max(
            dot(
                leatherNormal,
                lightDir
            ),
            0.0
        );


    // --------------------------------------------------------
    // Specular
    //
    // La pelle non è uno specchio:
    // highlight presente ma largo e morbido.
    // --------------------------------------------------------

    vec3 halfDir =
        normalize(
            lightDir +
            viewDir
        );

    float specular =
        pow(
            max(
                dot(
                    leatherNormal,
                    halfDir
                ),
                0.0
            ),
            22.0
        );


    // --------------------------------------------------------
    // Rugosità irregolare
    //
    // Riduce localmente il riflesso,
    // evitando l'effetto "plastica perfetta".
    // --------------------------------------------------------

    float roughness =
        mix(
            0.45,
            0.85,
            leather
        );

    specular *= (
        1.0 -
        roughness * 0.65
    );


    // --------------------------------------------------------
    // Illuminazione finale
    // --------------------------------------------------------

    float ambient =
        0.16;

    vec3 color =
        baseColor *
        (
            ambient +
            0.88 * diffuse
        );

    color +=
        vec3(
            1.0,
            0.28,
            0.18
        ) *
        specular *
        0.75;

    // --------------------------------------------------------
    // La cucitura prende un piccolo riflesso.
    // --------------------------------------------------------

   /*
    * Piccolo rilievo luminoso sulle cuciture.
    * Serve a farle sembrare fisicamente sopra
    * la superficie e non semplicemente dipinte.
    */
    color +=
        seam *
        vec3(
            0.10,
            0.018,
            0.012
        ) *
        diffuse;


    /*
    * Il filo prende un riflesso leggermente
    * più evidente della pelle circostante.
    */
    color +=
        stitches *
        vec3(
            0.12,
            0.055,
            0.035
        ) *
        (
            0.20 +
            0.45 * diffuse
        );

    return color;
}


// ============================================================
// DINAMICA DEL COLPO
// ============================================================

/*
 * Calcola lo spostamento dell'intera sfera dopo l'impatto.
 *
 * L'attacco è molto rapido:
 *
 *     1 - exp(-attackSpeed * t)
 *
 * quindi il movimento sembra prodotto da un pugno
 * invece che da una spinta continua.
 *
 * Dopo l'impatto:
 *
 *     exp(-returnSpeed * t)
 *
 * riporta progressivamente la sfera al centro
 * senza oscillazioni.
 */
float getDisplacement(
    float tHit,
    float strength
)
{
    float attackSpeed =
        30.0;

    float returnSpeed =
        2.5;

    float attack =
        1.0 -
        exp(-attackSpeed * tHit);

    float recovery =
        exp(-returnSpeed * tHit);

    return strength *
           attack *
           recovery;
}


// ============================================================
// MAIN
// ============================================================

void main()
{
    // --------------------------------------------------------
    // Coordinate dello schermo
    // --------------------------------------------------------

    /*
     * Convertiamo gl_FragCoord in coordinate centrate
     * intorno a (0,0).
     */
    vec2 uv =
        gl_FragCoord.xy /
        u_resolution.xy -
        0.5;

    /*
     * Correzione dell'aspect ratio.
     *
     * Senza questa correzione la sfera apparirebbe
     * schiacciata nelle viewport non quadrate.
     */
    uv.x *=
        u_resolution.x /
        u_resolution.y;


    // --------------------------------------------------------
    // Camera
    // --------------------------------------------------------

    // Origine dei raggi: posizione della camera
    vec3 rayOrigin =
        vec3(0.0, 0.0, -3.0);

    /*
     * Ogni pixel produce un raggio leggermente diverso.
     * La direzione viene normalizzata in modo che la
     * distanza percorsa corrisponda al parametro del ray.
     */
    vec3 rayDirection =
        normalize(vec3(uv, 1.0));

    // --------------------------------------------------------
    // Parametri del colpo
    // --------------------------------------------------------

    // Punto della superficie colpito
    vec3 hitPos =
        normalize(
            -u_hitDir
        );

    // Direzione nella quale il pugno spinge la sfera
    vec3 hitDir =
        normalize(
            u_hitDir
        );

    // Intensità del colpo
    float strength =
        u_hitStrength;




    // --------------------------------------------------------
    // Temporizzazione dell'impatto
    // --------------------------------------------------------

    /*
     * Durante i test il colpo viene ripetuto ogni 5 secondi.
     *
     * mod() trasforma u_time in un tempo locale che riparte
     * da zero a ogni nuovo colpo.
     */
    float interval =
        5.0;

    float hitTime =
        1.0;

    float tHit =
        max(
            u_time - u_hitTime,
            0.0
        );


    // --------------------------------------------------------
    // Movimento e deformazione
    // --------------------------------------------------------

    float displacement =
        getDisplacement(
            tHit,
            strength
        );

    /*
     * L'intera sfera arretra nella direzione della forza.
     */
    vec3 sphereCenter =
        hitDir * displacement;

    /*
     * Profondità dell'ammaccatura.
     *
     * È massima all'impatto e decade progressivamente,
     * permettendo alla sfera di recuperare la propria forma.
     */
    float dentStrength =
        1.35 *
        exp(-3.0 * tHit);


    // --------------------------------------------------------
    // Ray marching
    // --------------------------------------------------------

    float rayDistance =
        0.0;

    bool sphereHit =
        false;

    vec3 hitPoint =
        vec3(0.0);

    /*
     * Procediamo lungo il raggio usando come passo
     * la distanza restituita dalla SDF.
     */
    for (int i = 0; i < 100; i++)
    {
        vec3 p =
            rayOrigin +
            rayDirection * rayDistance;

        float distanceToSphere =
            sdSoftSphere(
                p,
                sphereCenter,
                1.0,
                tHit,
                hitDir,
                hitPos,
                dentStrength
            );

        /*
         * Distanza sufficientemente piccola:
         * consideriamo raggiunta la superficie.
         */
        if (distanceToSphere < 0.001)
        {
            sphereHit = true;
            hitPoint = p;

            break;
        }

        rayDistance +=
            distanceToSphere;

        /*
         * Il raggio è ormai troppo lontano dalla scena.
         */
        if (rayDistance > 20.0)
        {
            break;
        }
    }


    // --------------------------------------------------------
    // Colore finale del fragment
    // --------------------------------------------------------

    /*
     * Di default ogni pixel mostra lo sfondo.
     */
    vec3 background =
        getBackground(uv);

    vec3 finalColor =
        background;

    /*
     * Se il ray marching ha incontrato la sfera,
     * sostituiamo il background con il colore
     * illuminato della superficie.
     */
    if (sphereHit)
    {
        vec3 normal =
            getNormal(
                hitPoint,
                sphereCenter,
                1.0,
                tHit,
                hitDir,
                hitPos,
                dentStrength
            );

        finalColor =
            shadeSphere(
                hitPoint,
                sphereCenter,
                normal
            );
    }


    // --------------------------------------------------------
    // Output del fragment shader
    // --------------------------------------------------------

    fragColor =
        vec4(finalColor, 1.0);
}