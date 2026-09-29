# Snake

Klasyczna gra Snake w czystym JavaScripcie (moduły ES + Canvas 2D), bez npm, bundlera i bibliotek.
Projekt szkoleniowy — pełne wymagania w [wymagania.md](wymagania.md).

**Zagraj:** https://&lt;uzytkownik&gt;.github.io/snake/ <!-- podmień na właściwy adres po włączeniu GitHub Pages -->

## Sterowanie

| Klawisz | Działanie |
|---|---|
| Strzałki ↑ ↓ ← → | zmiana kierunku; na ekranie startowym — start gry |
| Enter | po końcu gry — nowa gra |

Wąż przechodzi przez ściany na drugą stronę planszy. Gra kończy się, gdy głowa wjedzie we własne ciało.
Co 5 zjedzonych owoców wąż przyspiesza. Rekord zapisywany jest w przeglądarce (`localStorage`).

## Uruchomienie lokalnie

Moduły ES nie działają z pliku otwartego dwuklikiem (`file://`), potrzebny jest prosty serwer:

- rozszerzenie **Live Server** w VS Code → „Open with Live Server” na `index.html`, albo
- w katalogu projektu: `python -m http.server 8000` i adres http://localhost:8000

## Testy

Wymagany Node.js 18+. Bez instalowania zależności:

```
node --test
```

Plik `package.json` zawiera tylko `"type": "module"`, żeby Node wczytywał pliki `.js` jako moduły ES.

## Struktura

```
index.html        strona: canvas i pasek wyniku
style.css         wygląd strony
src/game.js       czysta logika gry (bez DOM, canvas, localStorage i Math.random)
src/render.js     rysowanie stanu gry na canvas
src/input.js      obsługa klawiatury
src/storage.js    odczyt/zapis rekordu
src/main.js       pętla gry, stany, timer
tests/game.test.js  testy logiki (node:test)
```

## Publikacja (GitHub Pages)

Settings → Pages → *Deploy from a branch* → gałąź `main`, katalog `/ (root)`. Krok budowania nie jest potrzebny.
