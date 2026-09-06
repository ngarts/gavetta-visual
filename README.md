# Gavetta Visual

**An audio-driven generative visual system built with Python, OpenGL and GLSL.**

> La musica non accompagna le immagini.  
> Contribuisce a dirigerle.

**Gavetta Visual** is the audiovisual engine created for the official video of  
**“Gavetta” by Nicola Gullo**.

Rather than editing a sequence of visual effects manually on a traditional video
timeline, the project analyzes the song, extracts objective audio features and
uses them to determine both the visual sequence and the behavior of the shaders.

The result is a deterministic audiovisual performance in which the music
contributes to its own visual direction.

## Watch the final video

The official visual video of **“Gavetta” by Nicola Gullo** was generated
with this project.

▶ **Nicola Gullo – Gavetta (Official Visual Video)**  
https://youtu.be/o009C6Qxiv4






---





## Concept

The project is based on a simple separation of responsibilities:

> **Analyze describes. Director interprets. Shaders represent.**

The audio analyzer does not know anything about scenes, visual meaning or GLSL
shaders.

It only measures the audio.

The Director receives those measurements and decides which visual language is
most appropriate for different sections of the song.

Finally, the shaders turn those decisions into images.

```text
WAV
 │
 ▼
Audio Analysis
 │
 ▼
gavetta-analysis.json
 │
 ▼
Director
 │
 ▼
gavetta-playlist.json
 │
 ▼
Player / Offline Renderer
 │
 ▼
GLSL Shaders
 │
 ▼
Video
```

This keeps signal analysis, artistic interpretation and rendering independent
from each other.

---

## How it works

### 1. Audio analysis

The master WAV is analyzed offline in Python.

The analyzer works on overlapping FFT windows and extracts measurements such as:

- RMS energy
- attack
- spectral flux
- spectral centroid
- spectral spread
- energy in frequency bands

The frequency spectrum is divided into:

```text
Sub        20 – 60 Hz
Bass       60 – 160 Hz
Low Mid   160 – 500 Hz
Mid       500 – 2000 Hz
High Mid 2000 – 6000 Hz
High     6000 – 16000 Hz
```

The analyzer deliberately stops here.

It does not try to recognize instruments, classify musical sections or assign
artistic meaning to the signal.

Its job is to describe what is present in the audio.

---

### 2. Event detection

Transient activity is detected from attack and spectral-flux measurements.

Local peaks become visual events when they satisfy the Director's event rules.

Each event contains information including:

- timestamp
- strength
- attack
- spectral flux
- spectral centroid
- spectral spread
- frequency-band energies

These events can later affect individual shaders without requiring the renderer
to analyze the audio in real time.

---

### 3. The Director

The Director is the artistic decision layer of the system.

It reads the analysis generated from the song and evaluates consecutive time
windows.

Each shader has its own affinity function.

For example, some scenes favor:

- strong transient peaks
- sustained energy
- distributed transient activity
- quieter passages
- combinations of sustained and transient energy

The Director scores the available shaders and selects the most suitable one
while also applying constraints designed to preserve visual variety.

The selection is **deterministic**, not random.

Running the Director again with the same analysis and configuration therefore
produces the same visual direction.

The generated result is stored in:

```text
data/gavetta-playlist.json
```

The playlist explicitly describes:

- scene start
- scene end
- selected shader
- visual events
- event parameters
- optional textures
- Director diagnostics

This makes the artistic decisions inspectable rather than hiding them inside
the renderer.

---

## Visual fatigue

Selecting only the mathematically highest-scoring shader can cause one visual
language to dominate the video.

The Director therefore keeps track of previous shader usage and progressively
reduces the score of frequently selected scenes.

This is not randomization.

The music still drives the decision, but previous visual usage becomes part of
the decision context.

The result preserves musical responsiveness while avoiding unnecessary visual
repetition.

---

## The shaders

The project currently contains eight GLSL fragment shaders.

### Impact Sphere

A deformable red sphere reacts physically to detected impacts.

The sphere is rendered using ray marching and a signed distance field. Events
control the direction and intensity of its deformation.

### Triangle Tunnel

A tunnel of luminous triangles creates a continuous sensation of movement
through geometric paths.

### Infinity Glass

A luminous glass infinity symbol built from a parametric lemniscate.

The shader includes pseudo-depth, branch occlusion and a travelling light pulse
moving along the curve.

### Suspended Fragments

Irregular luminous fragments float in space.

Detected events activate deterministic subsets of the fragments, producing
distributed reactions rather than a single global flash.

### Matrix

A procedural digital rain built entirely in GLSL.

Multiple depth layers and selected reactive columns create a dense,
music-sensitive field.

### Saturn

A cold blue and indigo planetary scene with rings.

A small red sphere moves continuously along the rings, visually recalling the
sphere introduced earlier in the video.

### Wanderer Fog

A still image is transformed into an atmospheric scene by a GLSL shader.

The fog responds to the music through changes in brightness and bloom.

### Fractal Nebula

A procedural incandescent nebula generated using layered noise, FBM and domain
warping.

The entire field rotates slowly while preserving its internal turbulent
structure.

---

## A visual narrative

Although the visual direction is generated from audio measurements, the final
sequence also creates a narrative progression.

Some visual elements return in different contexts.

The red sphere first appears as an object receiving impacts. Later, the same
visual motif reappears travelling along the rings of Saturn.

Near the end of the song, **Wanderer Fog** accompanies the final words.

After the words and music have ended, only the vinyl crackle remains and the
Director returns to **Infinity Glass** for the final scene.

These relationships were not created by manually assembling a traditional
video timeline. They emerged from the interaction between the song, the
Director's rules and the visual vocabulary designed for the project.

---

## Real-time player

The project includes a real-time player based on:

- Python
- pygame
- ModernGL
- OpenGL 3.3
- GLSL

The player loads the generated playlist, compiles the required shaders and
applies visual events at their scheduled timestamps.

It does not perform FFT analysis while playing.

All musical analysis and directing decisions have already been calculated.

---

## Offline renderer

For the final video, the project uses a deterministic offline renderer.

Instead of recording the real-time player, every video frame is generated for
an exact timestamp:

```python
current_time = frame_index / FPS
```

This means rendering performance does not determine video timing.

A complex shader may require more time to calculate a frame, but the resulting
video still advances at exactly the requested frame rate.

For the final **Gavetta** render:

```text
Resolution:     1920 × 1080
Frame rate:     60 fps
Duration:       192 seconds
Frames:         11,520
Video codec:    H.264
Pixel format:   yuv420p
Audio:          AAC, 48 kHz stereo
```

The 11,520 frames are rendered through OpenGL and streamed directly to FFmpeg as
raw RGB data.

FFmpeg encodes the video and independently reads the original master WAV,
keeping audio rendering separate from scene generation.

No intermediate PNG sequence is required.

In other words:

> **Python conducts the orchestra; the GPU plays it.**

---

## Project structure

```text
gavetta-visual/
│
├── analysis/
│   ├── analyze.py
│   ├── audio.py
│   ├── frames.py
│   ├── spectrum.py
│   ├── features.py
│   ├── output.py
│   └── requirements.txt
│
├── director/
│   ├── playlist.py
│   ├── events.py
│   └── mappings.py
│
├── player/
│   └── play.py
│
├── renderer/
│   └── render.py
│
├── shaders/
│   ├── impact-sphere.frag
│   ├── triangle-tunnel.frag
│   ├── infinity-glass.frag
│   ├── fragments.frag
│   ├── matrix.frag
│   ├── saturn.frag
│   ├── wanderer-fog.frag
│   └── fractal-nebula.frag
│
├── images/
│   └── wanderer-fog.png
│
├── audio/
│   └── [audio files are not included]
│
├── data/
│   ├── gavetta-analysis.json
│   └── gavetta-playlist.json
│
├── output/
│   └── [rendered videos are not included]
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## Running the project

### Requirements

The project requires:

- Python 3
- OpenGL 3.3 compatible GPU
- pygame
- ModernGL
- NumPy
- FFmpeg for offline video rendering

Create and activate a Python virtual environment, then install the project
dependencies.

The final renderer also requires `ffmpeg` to be available from the command
line.

---

### Audio

The original recording of **Gavetta** is copyrighted and is intentionally not
included in this repository.

To experiment with the engine, place your own WAV file in the `audio/`
directory and configure the project to use it.

Audio files are excluded from Git:

```gitignore
audio/*.wav
audio/*.flac
```

---

### Analyze the audio

Run:

```bash
python analysis/analyze.py
```

The analysis is written to:

```text
data/gavetta-analysis.json
```

---

### Generate the visual direction

Run:

```bash
python director/playlist.py
```

The Director reads the analysis and generates:

```text
data/gavetta-playlist.json
```

---

### Run the real-time player

```bash
python player/play.py
```

The player loads the generated playlist and executes the selected GLSL scenes.

---

### Render the final video

With FFmpeg installed and available in `PATH`:

```bash
python renderer/render.py
```

The renderer generates the video frame by frame using OpenGL and sends the
result directly to FFmpeg.

Rendered MP4 files are intentionally excluded from the repository:

```gitignore
output/*.mp4
```

---

## Using another song

The architecture is not limited to *Gavetta*.

The intended workflow is:

```text
your-song.wav
      │
      ▼
   Analyzer
      │
      ▼
 audio features
      │
      ▼
   Director
      │
      ▼
visual playlist
      │
      ▼
Player / Renderer
```

A different song therefore produces different measurements, events and
directing decisions.

The visual vocabulary can also be extended by adding new shaders and defining
how the Director should evaluate them.

---

## Design principles

The project follows a few deliberate principles:

1. **Analysis remains objective.**  
   Signal processing describes the audio without deciding what it means
   artistically.

2. **Direction is explicit.**  
   Artistic decisions belong to the Director rather than being hidden inside
   shaders or the audio analyzer.

3. **Shaders remain visual instruments.**  
   They receive time, events and parameters and concentrate on rendering.

4. **Determinism matters.**  
   The same input and configuration produce the same direction.

5. **The playlist remains inspectable.**  
   Automated direction does not mean giving up artistic control.

6. **Audio and video remain independent during offline rendering.**  
   GPU rendering speed cannot alter the timing of the song.

---

## Why this project exists

This project started from the idea of creating a visual accompaniment for a
song.

It eventually became something different.

Instead of asking:

> “How can visuals react to music?”

the project asks:

> **“Can the music participate in deciding what we see?”**

That distinction led to the separation between analysis, direction and visual
representation that now defines the architecture.

The result is neither a conventional manually edited music video nor simply a
real-time audio visualizer.

It is a small generative directing system built specifically around the
relationship between music, code and visual storytelling.

---

## Credits

**Concept, music and project:** Nicola Gullo

Developed through an iterative human–AI collaboration with **ChatGPT by
OpenAI**, covering system architecture, signal-analysis design, Director logic,
GLSL development, debugging and offline rendering.

---

## License

The source code in this repository is released under the **MIT License**.

See:

```text
LICENSE
```

The song **“Gavetta”**, its master recording, lyrics, artwork and other
associated artistic assets are **not** covered by the MIT License and remain
copyrighted by their respective rights holder(s).

The absence of the master audio from this repository is intentional.

---

## Gavetta

The source code can generate the images.

The repository can explain the system.

But the audiovisual work begins with the song.