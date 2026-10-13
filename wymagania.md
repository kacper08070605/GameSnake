# Snake — wymagania

## 1. Cel

Klasyczna gra Snake (wąż) w JavaScript, uruchamiana w przeglądarce na komputerze.
Projekt szkoleniowy na kurs: gra ma **działać poprawnie** i mieć **prosty, czytelny kod**,
który da się omówić na zajęciach. Kod jest przechowywany na GitHubie, a gra publikowana
przez GitHub Pages.

**Kryteria sukcesu**
- Gra jest dostępna pod publicznym adresem GitHub Pages i działa w aktualnym Chrome, Edge i Firefox.
- Da się rozegrać pełną partię: start → jedzenie → przyspieszanie → koniec gry → ponowna gra.
- Rekord zostaje zapamiętany po odświeżeniu strony.
- Testy logiki przechodzą poleceniem `node --test` bez instalowania żadnych zależności.

## 2. Zakres

**W zakresie (wersja 1):** ruch węża, jedzenie, punktacja, przechodzenie przez ściany, kolizja z ogonem,
przyspieszanie, rekord w `localStorage`, ekran startowy i ekran końca gry, testy logiki,
publikacja na GitHub Pages.

**W zakresie (wersja 2):** pauza, zapis przerwanej gry w Supabase i jej wznawianie,
publiczna tabela 10 najlepszych wyników (gracze anonimowi, nick podawany przy wejściu do top 10).

**W zakresie (wersja 3):** konta graczy — login + hasło, profil (login, najlepszy wynik, liczba gier),
zapis gry i wyniki przypięte do konta (dostępne w każdej przeglądarce). Gra bez logowania dalej możliwa;
rejestracja zamienia gościa w konto z zachowaniem jego zapisu i wyników.

**Poza zakresem:** dźwięki, sterowanie dotykowe / wersja mobilna, poziomy trudności,
przeszkody na planszy, reset zapomnianego hasła, ochrona tabeli przed celowo sfałszowanymi wynikami.

## 3. Zasady gry

| Element | Wartość |
|---|---|
| Plansza | 20 × 20 pól |
| Rozmiar pola | 20 px (canvas 400 × 400 px) |
| Wąż na starcie | 3 segmenty, poziomo, na środku planszy, kierunek: w prawo |
| Jedzenie | 1 owoc na planszy, w losowym wolnym polu (nigdy na wężu) |
| Zjedzenie owocu | +1 punkt, wąż rośnie o 1 segment, pojawia się nowy owoc |
| Prędkość startowa | 1 ruch co 150 ms |
| Przyspieszanie | co 5 zjedzonych owoców interwał krótszy o 10 ms |
| Prędkość maksymalna | 1 ruch co 60 ms (dalej już nie przyspiesza) |
| Ściany | uderzenie w krawędź planszy **nie** kończy gry — wąż pojawia się po przeciwnej stronie planszy |
| Koniec gry | głowa wjeżdża we własne ciało |
| Wygrana | wąż zajmuje całą planszę (brak wolnego pola na owoc) → koniec gry z komunikatem „Wygrana!” |

**Szczegóły ruchu**
- Wąż porusza się o jedno pole na każdy „tick” gry.
- Zmiana kierunku o 180° (np. z prawo na lewo) jest ignorowana.
- W jednym ticku uwzględniana jest najwyżej jedna zmiana kierunku; kolejne naciśnięcie
  w tym samym ticku jest buforowane i stosowane w następnym (zapobiega „zawracaniu w siebie”
  przy szybkim wciśnięciu dwóch strzałek).
- Ruch na pole, z którego w tym samym ticku schodzi ogon, **nie** jest kolizją.
- Przejście przez ścianę: wyjście za prawą krawędź przenosi głowę na pierwsze pole z lewej
  w tym samym wierszu (i analogicznie dla lewej, górnej i dolnej krawędzi). Wąż nie traci
  przy tym punktów ani długości. Kolizja z własnym ciałem po drugiej stronie planszy kończy grę.

## 4. Sterowanie

| Klawisz | Działanie |
|---|---|
| Strzałki ↑ ↓ ← → | zmiana kierunku; na ekranie startowym — rozpoczęcie gry |
| Spacja / Esc | pauza (z zapisem gry w bazie) i wznowienie |
| Enter | na ekranie końca gry lub w pauzie — nowa gra |

Strzałki nie mogą przewijać strony podczas gry (`preventDefault`).

## 5. Ekrany i stany gry

Gra ma cztery stany: `start` → `playing` ⇄ `paused`, `playing` → `over` → (Enter) → `playing`.
Zapisana gra jest odtwarzana przy wejściu na stronę od razu w stanie `paused`.

- **Start:** plansza z wężem w pozycji początkowej, napis „Naciśnij strzałkę, aby zacząć”, widoczny rekord.
- **Gra:** plansza, nad nią pasek z bieżącym wynikiem i rekordem.
- **Koniec gry:** półprzezroczysta nakładka na planszy: „Koniec gry” (lub „Wygrana!”), wynik,
  rekord, informacja „Nowy rekord!” jeśli został pobity, „Enter — zagraj ponownie”.

**Rekord:** zapisywany w `localStorage` pod kluczem `snake.highScore` w momencie końca gry,
jeśli wynik jest wyższy. Gdy `localStorage` jest niedostępny (np. tryb prywatny),
gra działa normalnie, a rekord obowiązuje tylko do odświeżenia strony.

## 6. Oprawa wizualna

Prosta i kontrastowa: ciemne tło planszy, zielony wąż (głowa w jaśniejszym odcieniu),
czerwony owoc, delikatna siatka pól opcjonalnie. Plansza wyśrodkowana na stronie,
tytuł „Snake” nad nią. Czcionka systemowa, bez zewnętrznych zasobów.

## 7. Architektura

Czysty JavaScript (moduły ES), Canvas 2D, **bez npm, bundlera i bibliotek**.

**Wyjątek od zasady „bez bibliotek” (wersja 2):** `src/cloud.js` ładuje dynamicznie
`@supabase/supabase-js` z CDN jsDelivr (wersja przypięta). Testy `node --test` dalej nie wymagają
żadnych zależności. Schemat bazy: `supabase/schema.sql`; dane projektu: `src/config.js`.

```
/
├── index.html        # strona: canvas, pasek wyniku, <script type="module" src="src/main.js">
├── style.css         # wygląd strony
├── src/
│   ├── game.js       # CZYSTA logika gry — bez DOM, canvas, localStorage i bez bezpośredniego Math.random
│   ├── render.js     # rysowanie stanu gry na canvas
│   ├── input.js      # obsługa klawiatury → kierunki / akcje
│   ├── storage.js    # odczyt/zapis rekordu i nicku (localStorage z obsługą błędów)
│   ├── leaderboard.js # reguły tabeli wyników (top 10, poprawny nick)
│   ├── config.js     # adres i klucz publiczny projektu Supabase
│   ├── cloud.js      # komunikacja z Supabase (jedyny moduł, który ją zna)
│   └── main.js       # spina całość: pętla gry, stany, timer, zapis i wyniki
├── tests/
│   ├── game.test.js  # testy logiki (node:test + node:assert)
│   └── leaderboard.test.js # testy reguł tabeli wyników
├── supabase/
│   └── schema.sql    # tabele i reguły Row Level Security
├── README.md         # opis, jak uruchomić lokalnie, jak testować, link do gry
└── wymagania.md      # ten dokument
```

**Zasada podziału:** `game.js` operuje wyłącznie na danych. Losowanie jest wstrzykiwane
jako parametr (funkcja `random`), dzięki czemu testy są deterministyczne.

**Interfejs `game.js` (propozycja)**
- `createGame(options)` → stan początkowy `{ snake, direction, food, score, status, speedMs }`
  (`options`: rozmiar planszy, funkcja `random`).
- `changeDirection(state, dir)` → nowy stan z zabuforowanym kierunkiem (ignoruje zawrócenie o 180°).
- `step(state)` → nowy stan po jednym ticku (ruch z przejściem przez ściany, jedzenie, wzrost, kolizja z ciałem, przyspieszenie, koniec gry).
- Funkcje zwracają **nowy** obiekt stanu, nie modyfikują przekazanego.

**Pętla gry (`main.js`):** `setTimeout` z aktualnym `state.speedMs`; każdy tick wywołuje
`step`, a następnie `render`. Po przejściu w stan `over` pętla się zatrzymuje, zapisywany jest rekord.

## 8. Testy

Uruchamianie: `node --test` (Node.js 18+), bez `npm install`.

Wymagane przypadki testowe dla `game.js`:
1. Stan początkowy: wąż ma 3 segmenty, kierunek w prawo, wynik 0, owoc nie leży na wężu.
2. `step` przesuwa węża o jedno pole w bieżącym kierunku, długość bez zmian.
3. Zjedzenie owocu: wynik +1, długość +1, nowy owoc w wolnym polu.
4. Wyjście za każdą z czterech ścian nie kończy gry — głowa pojawia się po przeciwnej stronie planszy.
5. Wjechanie we własne ciało kończy grę.
6. Wjazd na pole zwalniane w tym samym ticku przez ogon nie kończy gry.
7. Zmiana kierunku o 180° jest ignorowana.
8. Dwie szybkie zmiany kierunku w jednym ticku nie powodują zawrócenia w siebie.
9. Po 5 zjedzonych owocach interwał maleje o 10 ms; nie spada poniżej 60 ms.
10. Brak wolnego pola na owoc → koniec gry z wygraną.

Rysowanie, klawiatura i `localStorage` sprawdzane ręcznie według listy:
- start strzałką, sterowanie wszystkimi strzałkami, strona się nie przewija;
- ekran końca gry, restart Enterem;
- rekord zostaje po odświeżeniu strony;
- zauważalne przyspieszenie po kilku owocach.

## 9. Uruchomienie i publikacja

- **Lokalnie:** moduły ES nie ładują się z pliku otwartego dwuklikiem (`file://`),
  dlatego potrzebny jest prosty serwer, np. rozszerzenie *Live Server* w VS Code
  lub `python -m http.server 8000` i adres `http://localhost:8000`.
- **GitHub:** publiczne repozytorium `GameSnake`, gałąź `master`.
- **GitHub Pages:** publikacja z gałęzi `master`, katalog główny (`/`) — bez kroku budowania.
  Link do gry umieszczony w `README.md`.

## 10. Wymagania jakościowe

- Kod i komentarze czytelne dla uczestnika kursu; nazwy po angielsku, komentarze mogą być po polsku.
- Brak błędów w konsoli przeglądarki podczas gry.
- Każdy plik ma jedną odpowiedzialność; `game.js` da się zrozumieć bez znajomości pozostałych plików.
