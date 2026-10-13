# Snake — grafiki i prompty

Motyw: **nocna dżungla z neonową zielenią**. Pasuje do obecnej palety gry, więc grafiki nie gryzą się
z wężem rysowanym w kodzie.

| Element | Kolor |
|---|---|
| Tło strony | `#0b0d10` |
| Tło planszy | `#111418` |
| Ciało węża | `#2e9d3a` |
| Głowa węża | `#6ee06e` |
| Owoc | `#e53935` |
| Wyróżnienie (rekord) | `#ffd54f` |

Plansza: 400×400 px, pole 20×20 px.

## Gdzie umieścić grafiki

| # | Miejsce | Plik / rozmiar | Uwagi |
|---|---|---|---|
| 1 | Tło strony wokół planszy (`body` w `style.css`) | 1920×1080, JPG | Największy efekt przy najmniejszym ryzyku. Środek ma być ciemny i pusty, bo tam stoi plansza. |
| 2 | Tło planszy (canvas, pod siatką) | 400×400, PNG/JPG | Bardzo niski kontrast, inaczej wąż i owoc znikną na tle. |
| 3 | Logo „SNAKE” zamiast nagłówka `h1` | ok. 800×200, PNG z przezroczystością | Generatory często psują litery, możliwa ręczna poprawka napisu. |
| 4 | Owoc zamiast czerwonego kółka | 64×64, PNG z przezroczystością, w grze skalowany do 20×20 | Musi być czytelny w bardzo małym rozmiarze. |
| 5 | Ekran startowy / koniec gry (pod półprzezroczystą nakładką) | 400×400, PNG | Opcjonalnie. Napisy rysuje kod, więc grafika nie może mieć tekstu. |

Węża lepiej zostawić rysowanego w kodzie: przy polach 20 px grafika segmentów wymagałaby osobnych
kawałków na zakręty, głowę i ogon w każdym kierunku.

Na początek warto zrobić pozycje 1 i 4: najmniej pracy i największy efekt.

## Prompty

### 1. Tło strony

```
Atmospheric background for a browser snake game page, 16:9, 1920x1080, digital matte painting. Theme: a dense tropical jungle at night, seen from above, mysterious and calm. Composition: the central 45% of the frame is an almost empty, very dark blue-black area (smooth, low contrast, subtle soft texture) - reserved for the square game board. All detail pushed to the edges: large dark jungle leaves, ferns and twisted vines framing the left and right sides, a few faint glowing green bioluminescent spots and fireflies near the edges, thin mist in the corners. Lighting: low-key, moonlit, deep shadows, soft neon-green rim light only at the edges. Palette: blue-black (#0b0d10), deep charcoal, dark jungle green, neon green (#6ee06e) accents, a tiny touch of warm red. No text, no letters, no logos, no snakes, no animals, no people, nothing in the center. Highly detailed edges, soft clean center, 4K.
```

### 2. Tło planszy

```
Seamless top-down texture for a snake game board, square 1:1, 400x400. Dark mossy jungle floor seen straight from above: very subtle dark soil, tiny moss patches and faint leaf shapes, extremely low contrast, almost uniform near-black (#111418) with barely visible dark green tones. Flat even lighting, no shadows, no highlights, no vignette. Must stay very dark and calm so bright green and red game pieces remain clearly visible on top. No objects, no text, no grid lines, no snakes, no animals. Minimalist, smooth, tileable.
```

### 3. Logo

```
Game title logo with the word "SNAKE", wide horizontal banner, transparent background. Bold chunky rounded letters in glossy neon green (#6ee06e) with a darker green (#2e9d3a) outline and a soft green glow, a subtle snake-scale texture inside the letters, the letter S slightly shaped like a coiled snake with a small tongue. Clean vector-like game UI style, sharp edges, high contrast, readable at small size. Only the word "SNAKE", no other text, no background scenery.
```

### 4. Owoc

```
Single game item icon: a shiny red apple (#e53935) with one small green leaf, top-down slight 3/4 view, centered, transparent background, square 1:1. Simple bold shapes, clean thick outline, small white highlight, soft glow, cartoon game-asset style. Must stay clearly recognizable when scaled down to 20x20 pixels - no fine details, no texture noise. No text, no shadow on the ground, no other objects.
```

### 5. Ekran startowy / koniec gry

```
Square 1:1 illustration, 400x400, for the start screen of a snake game. A stylized green snake (#2e9d3a body, #6ee06e head) coiled in the lower part of the frame, looking up at a red apple, set in a dark night jungle with soft glowing fireflies. Digital illustration, clean game-art style, dark blue-black background (#111418), neon-green rim light. The upper-middle half of the image must be dark, calm and empty - text will be drawn there by the game. No text, no letters, no logos, no UI.
```
