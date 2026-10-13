# Wąż bez Granic

Klasyczna gra Snake w czystym JavaScripcie (moduły ES + Canvas 2D), bez npm i bundlera.
Wyniki i zapisane gry trzymane są w Supabase (biblioteka `supabase-js` ładowana z CDN).
Projekt szkoleniowy — pełne wymagania w [wymagania.md](wymagania.md).

**Zagraj:** https://kacper08070605.github.io/GameSnake/

## Sterowanie

| Klawisz | Działanie |
|---|---|
| Strzałki ↑ ↓ ← → | zmiana kierunku; na ekranie startowym — start gry |
| Spacja / Esc | pauza (z zapisem gry w bazie) i wznowienie |
| Enter | po końcu gry lub w pauzie — nowa gra |

Wąż przechodzi przez ściany na drugą stronę planszy. Gra kończy się, gdy głowa wjedzie we własne ciało.
Co 5 zjedzonych owoców wąż przyspiesza. Rekord zapisywany jest w przeglądarce (`localStorage`).

Wyniki trafiają do publicznej tabeli 10 najlepszych (Supabase). Przerwaną grę (Spacja / Esc albo
zamknięcie karty) można wznowić po powrocie w tej samej przeglądarce. Bez połączenia z bazą gra działa
normalnie, tylko bez tabeli i wznawiania.

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
index.html              strona: canvas, pasek wyniku, tabela najlepszych, formularz nicku
style.css               wygląd strony
src/game.js             czysta logika gry (bez DOM, canvas, localStorage i Math.random)
src/leaderboard.js      reguły tabeli wyników (kto wchodzi do top 10, poprawny nick)
src/render.js           rysowanie stanu gry na canvas
src/input.js            obsługa klawiatury
src/storage.js          odczyt/zapis rekordu i nicku
src/config.js           adres i klucz publiczny projektu Supabase
src/cloud.js            komunikacja z Supabase (logowanie anonimowe, zapis gry, wyniki)
src/main.js             pętla gry, stany, timer, przepływ zapisu i wyników
tests/game.test.js        testy logiki gry (node:test)
tests/leaderboard.test.js testy reguł tabeli wyników
supabase/schema.sql     tabele i reguły dostępu (Row Level Security) w bazie
```

## Publikacja (GitHub Pages)

Settings → Pages → *Deploy from a branch* → gałąź `master`, katalog `/ (root)`. Krok budowania nie jest potrzebny.
