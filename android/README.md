# Тихий дом 12.0 — Android

Это Android-обёртка вокруг того же HTML-билда, что и iOS-версия 12.0.
Игра лежит целиком в `app/src/main/assets/Game/index.html`.

## Что внутри
- онлайн через `wss://klyrosm.ru/ws?game=hushwood`;
- один игрок = парень в синем;
- версия 12.0, без новых GLB-персонажей из 12.1;
- полноэкранный landscape WebView, звук и WebGL включены.

## Сборка
1. Открой папку в Android Studio.
2. Дождись Gradle Sync.
3. Build → Build Bundle(s) / APK(s) → Build APK(s).

Или из консоли:

```bash
gradle assembleDebug
```

Готовый APK будет в `app/build/outputs/apk/debug/app-debug.apk`.

## Требования
- JDK 17;
- Android SDK с platform 35 и build-tools 35;
- minSdk 24 (Android 7.0+).
