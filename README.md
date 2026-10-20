# Hits & Licks – prototyp 0.1

Hrateľný náčrt mobilnej gangsterskej RPG v prehliadači. Mesto je pixel art (Phaser 3), menu a obrazovky sú v HTML.

## Spustenie

Dvojklik na `spustit.cmd`. Spustí lokálny server na http://localhost:8080 a otvorí hru. Okno servera nechaj otvorené, zatvorením hru vypneš.

Ovládanie: joystick vľavo dole alebo WASD / šípky, akcia tlačidlom vpravo alebo klávesom E. Mapu oddiališ tlačidlami + a −, kolieskom myši alebo dvoma prstami. V Nastaveniach je testovací režim, v ktorom čas beží 60× rýchlejšie.

## Štruktúra

- `js/config.js` – všetky čísla a vzorce (ladenie hry)
- `js/data.js` – predmety, misie, bossovia, rozmiestnenie NPC na mape
- `js/server.js` – simulovaný server: peniaze, odmeny, boje, ukladanie (neskôr pôjde na skutočný server)
- `js/combat.js` – automatický boj podľa statov
- `js/world.js` – mesto, pohyb, autá, polícia (Phaser)
- `js/ui.js` – HUD, menu a obrazovky
- `assets/` – mapa, sprity, ilustrácie, ikonky
- `tools/art/` – generátor grafiky (C#, spúšťa sa cez PowerShell `Add-Type`)
