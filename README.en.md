<div align="center">

<img src="docs/screenshots/hero-en.png" alt="Aion DPS Meter" width="100%">

# Aion DPS Meter

**Damage meter, event schedule and fight statistics for AION 2**

[![Version](https://img.shields.io/github/v/release/Accapura/AionDpsMeter?label=version&color=ffc66b&style=for-the-badge)](https://github.com/Accapura/AionDpsMeter/releases/latest)
[![Download](https://img.shields.io/badge/download-Windows%20x64-7c5cff?style=for-the-badge&logo=windows)](https://github.com/Accapura/AionDpsMeter/releases/latest)
[![License](https://img.shields.io/badge/license-GPL--3.0-3a3058?style=for-the-badge)](LICENSE)

[Русский](README.md) · **English**

</div>

---

## ✨ Features

| | |
|---|---|
| ⚔️ **In-game overlay** | Live DPS, damage, share, crit and healing of every group member. Boss HP, fight timer, comparison with your record. Modes: Dungeon: Boss, World: Boss, Mobs. |
| 🎯 **“Only me”** | Your own DPS, rank, damage, share and crit — big, instead of the list. |
| 📅 **Schedule** | Events, rifts and world bosses in the selected server’s time, reminders 15 / 5 / 1 min before, custom events, field boss timers straight from the game. |
| 📈 **Statistics** | Fight history, DPS-per-second chart with boss phases, fight comparison, boss records, DPS by class. |
| ☠️ **Death recap** | Who hit you and with what in the last 12 seconds before death. |
| 💬 **Discord** | “Boss fight” status in your profile and the fight summary posted to your guild channel with one button. |
| ⚡ **Light updates** | New versions (~1.5 MB) download and install themselves in seconds. |
| 🎨 **Look** | 11 themes, 5 notification styles, English and Russian. |

## 📸 Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/en-overlay.png" alt="Overlay"><br><sub><b>Overlay</b> — group damage in a fight</sub></td>
<td width="50%"><img src="docs/screenshots/en-solo.png" alt="Only me"><br><sub><b>“Only me”</b> — your DPS and rank</sub><br><br><img src="docs/screenshots/en-toast.png" alt="Update"><br><sub><b>Update</b> — one button</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/en-chart.png" alt="Fight chart"><br><sub><b>Fight chart</b> — DPS per second, boss HP and phases</sub></td>
<td><img src="docs/screenshots/en-compare.png" alt="Fight comparison"><br><sub><b>Fight comparison</b> — where damage was lost</sub></td>
</tr>
<tr>
<td><img src="docs/screenshots/en-death.png" alt="Death recap"><br><sub><b>Death recap</b> — the last 12 seconds</sub></td>
<td><img src="docs/screenshots/en-schedule.png" alt="Schedule"><br><sub><b>Schedule</b> — events in server time</sub></td>
</tr>
</table>

## 📥 Install

1. Download the installer **`AionDpsMeter.vX.Y.Z.exe`** from [**Releases**](https://github.com/Accapura/AionDpsMeter/releases/latest) and run it.
2. Pick the language, accept the agreement and choose a folder — the app appears in the Start menu.
3. To read fights you need (the installer checks and gives links):
   - [**Npcap**](https://npcap.com/#download) — traffic capture driver, install with default options;
   - [**.NET 10 Runtime**](https://dotnet.microsoft.com/download/dotnet/10.0) — for the fight reader (Windows x64).
4. Start Aion DPS Meter **before entering a dungeon** — the game sends player names on the loading screen.

**Supported clients:** AION 2 Global · Steam, AION 2 Global · PURPLE. Windows 10 / 11 x64.

After that the app updates itself: when “Update available” appears, click **“Update now”**.

## ⌨️ Hotkeys

| Keys | Action |
|---|---|
| `Ctrl+Shift+D` | show / hide the overlay |
| `Ctrl+Shift+L` | lock the overlay (click-through) |
| `Ctrl+Shift+R` | reset the meter |
| `Ctrl+Shift+C` | share the fight summary (image and text, or to a Discord channel) |
| `Ctrl+Shift+1` / `2` / `3` | Dungeon: Boss / World: Boss / Mobs mode |
| `Ctrl+Shift+M` | next mode (cycle) |

Every combination can be changed in Overlay → Hotkeys.

## 🛡️ How it works

Aion DPS Meter **only reads** the game’s network traffic on your computer (via Npcap): it sends nothing to the game and does not read or change its memory or files.

> [!IMPORTANT]
> The app is not affiliated with or endorsed by NCSoft. NCSoft has not publicly banned such damage meters, nor officially allowed them — you use the app at your own risk with regard to the NCSoft terms of service. If NCSoft bans them, fight reading will be disabled by an update. AION 2, class names and emblems are the property of NCSoft.

## 🔧 Building from source

```
app/      — the app (Electron 33): windows, overlay, schedule, statistics
bridge/   — fight reader (.NET 10): game packet parsing, JSON to stdout
setup/    — installer (NSIS) and light updates
```

```bash
cd bridge && dotnet publish -c Release -o ../bridge-out -p:UseAppHost=false
cd app && npm install && npm start
cd setup && python3 art.py <version> && python3 gen.py <version> <app_folder> && makensis setup.nsi
```

## 🙏 Credits and licenses

Aion DPS Meter is distributed under the **GNU GPL v3** — see [LICENSE](LICENSE).

- **AionMeter.Core** — [cyberbadger6969/aion2-dps-meter](https://github.com/cyberbadger6969/aion2-dps-meter) (GPL-3.0) — game protocol parsing.
- Game data tables — [taengu/A2Tools-DPS-Meter](https://github.com/taengu/A2Tools-DPS-Meter) (GPL-3.0); healing skill ids and class emblems — [Kuroukihime/AIon2-Dps-Meter](https://github.com/Kuroukihime/AIon2-Dps-Meter) (GPL-3.0). AION 2 game data © NCSOFT.
- SharpPcap, PacketDotNet (MIT), Electron (MIT), Chromium, Manrope font (SIL OFL 1.1).

## 💬 Author

<table><tr>
<td><img src="app/assets/logo.png" width="72" alt=""></td>
<td><b>Accapura</b><br>Development, ideas and support<br>Discord: <b>Accapura</b> · <a href="https://discord.com/users/256419758369538048">message</a></td>
</tr></table>

Found a bug? In the app: **Settings → Error report** — send the file to the author on Discord or open an [Issue](https://github.com/Accapura/AionDpsMeter/issues).
