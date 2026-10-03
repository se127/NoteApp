<div dir="rtl">

# note-app

یک برنامهٔ دسکتاپ یادداشت‌نویسی با Electron. رابط کاربری فارسی و راست‌به‌چپ (`fa-IR`) است و با shadcn/ui روی Tailwind CSS v4 ساخته شده.

## پشته

- Electron 44 — پروسهٔ اصلی و preload به‌صورت جاوااسکریپت خالص، بدون باندلر
- React 19 + TypeScript + Vite 8 با React Compiler فعال
- Tailwind CSS v4 به‌همراه مرتب‌کنندهٔ کلاس‌های `prettier-plugin-tailwindcss`
- shadcn/ui با سبک `radix-nova` و `rtl: true`
- SQLite از طریق `node:sqlite`؛ چون با Node داخلی Electron عرضه می‌شود، هیچ ماژول نیتیویی برای کامپایل یا بازسازی وجود ندارد

## دستورها

از [bun](https://bun.sh) استفاده کنید — نه npm، نه yarn و نه pnpm.

| دستور             | توضیح                                                       |
| ----------------- | ----------------------------------------------------------- |
| `bun run dev`     | Vite را بالا می‌آورد و سپس برنامه را در Electron باز می‌کند |
| `bun run dev:web` | فقط رندرر، در مرورگر روی `localhost:5173`                   |
| `bun run build`   | `tsc -b && vite build` — هم بررسی نوع و هم بیلد رندرر       |
| `bun run lint`    | oxlint                                                      |
| `bun run format`  | Prettier، شامل مرتب‌سازی کلاس‌های Tailwind                  |

پیش از هر commit باید `bun run build` اجرا شود. قلاب pre-commit آن را اجرا نمی‌کند، پس تنها جایی است که خطاهای نوع گرفته می‌شوند.

قالب‌بندی و lint را لازم نیست دستی اجرا کنید: قلاب pre-commit هر دو را روی فایل‌های staged انجام می‌دهد و موارد را خودکار اصلاح می‌کند. این قلاب از دستورهای مستقل سخت‌گیرانه‌تر است، چون `--deny-warnings` دارد؛ یعنی هشداری که `bun run lint` از آن عبور می‌کند، commit را متوقف می‌کند. جزئیات در `lint-staged.config.mjs`.

## بسته‌بندی برای ویندوز

| دستور                       | توضیح                                                          |
| --------------------------- | -------------------------------------------------------------- |
| `bun run build:windows`     | نصب‌کنندهٔ NSIS به‌صورت یک فایل `.exe` در `release/`           |
| `bun run build:windows:dir` | پوشهٔ باز و قابل اجرای `release/win-unpacked/`، بدون نصب‌کننده |

خروجی یک نصب‌کنندهٔ تک‌کلیکی است: کاربر روی آن دوبار کلیک می‌کند و برنامه به‌صورت per-user در `%LOCALAPPDATA%\Programs\Note App` نصب می‌شود، بنابراین هیچ درخواست رمز مدیر سیستمی نشان داده نمی‌شود. میان‌بر دسکتاپ و منوی استارت ساخته می‌شود و حذف‌کننده‌ای هم در بخش Apps & features ثبت می‌شود. اگر می‌خواهید کاربر مسیر نصب را انتخاب کند، در `electron-builder.yml` مقدار `oneClick: false` را بگذارید؛ NSIS فقط در نصب‌کنندهٔ راهنما انتخاب مسیر را نشان می‌دهد.

داده‌های کاربر با حذف برنامه پاک نمی‌شود، چون `deleteAppDataOnUninstall` روی `false` است. برای پاک کردن کامل، کاربر باید پوشهٔ `%APPDATA%\Note App` را حذف کند.

### نیازمندی wine برای ساخت روی لینوکس یا مک

نصب‌کنندهٔ NSIS یک فایل اجرایی ۳۲ بیتی است و electron-builder باید آن را زیر wine اجرا کند تا حذف‌کننده را بسازد. به همین دلیل wine باید بخش **۳۲ بیتی** را هم داشته باشد؛ در غیر این صورت ساخت با خطای `failed to load C:\windows\syswow64\ntdll.dll` در انتها شکست می‌خورد. روی دبیان و اوبونتو:

```
sudo dpkg --add-architecture i386
sudo apt update
sudo apt install wine32:i386
WINEARCH=win64 wineboot -u   # یک‌بار برای ساخت prefix
```

اگر wine از قبل نصب است ولی `syswow64` خالی است، باید prefix را از نو ساخت: `rm -rf ~/.wine` و بعد `wineboot -i` بدون تنظیم `WINEARCH`.

اسکریپت `scripts/build.ts` پیش از شروع، وجود wine و پشتیبانی ۳۲ بیتی را بررسی می‌کند تا این خطا بعد از چند دقیقه فشرده‌سازی ظاهر نشود.

روی خود ویندوز هیچ ابزار اضافه‌ای لازم نیست.

### چه چیزی به کاربر بدهیم

فقط یک فایل: `release/Note App-<version>.exe`. پوشهٔ `win-unpacked/` خروجی داخلی ساخت است و توزیع نمی‌شود، و فایل `.blockmap` هم فقط برای به‌روزرسانی خودکار است که در این پروژه تنظیم نشده.

هیچ گواهی امضای کدی وجود ندارد، پس SmartScreen ویندوز در اجرای اول هشدار می‌دهد و کاربر باید آن را با _More info_ → _Run anyway_ نادیده بگیرد. این را حتماً همراه فایل توضیح دهید، وگرنه فایل بدافزار به نظر می‌رسد.

این نسخه فقط برای معماری x64 ساخته می‌شود.

پیکربندی در `electron-builder.yml` است. خروجی در `release/` قرار می‌گیرد که در gitignore شده. هنوز آیکونی ثبت نشده، بنابراین ویندوز آیکون پیش‌فرض Electron را نشان می‌دهد؛ برای جایگزینی، یک `build/icon.ico` اضافه کنید.

## ساختار پروژه

```
electron/main.mjs      پروسهٔ اصلی Electron (پنجره، منو، محافظت از ناوبری)
electron/preload.cjs   پل contextBridge که به‌صورت window.noteApp در دسترس است
electron/db.mjs        دسترسی به SQLite برای جدول یادداشت‌ها
scripts/dev.ts         هماهنگ‌کنندهٔ توسعه: Vite + Electron
scripts/build.ts       هماهنگ‌کنندهٔ بسته‌بندی: Vite + electron-builder
src/components/        کامپوننت‌های اختصاصی: note-card، character-count، theme-toggle
src/components/ui/     کامپوننت‌های vendored شدهٔ shadcn — هرگز ویرایش دستی نکنید
src/pages/             فهرست یادداشت‌ها، ساخت یادداشت جدید، ویرایش یادداشت
src/font/vazirmatn/    Vazirmatn روی خود سرور (فارسی + ارقام، بدون لاتین)
```

قلم‌ها بر اساس هر گلیف انتخاب می‌شوند: Vazirmatn برای خط عربی، Inter برای لاتین و در نهایت `sans-serif` به‌عنوان جایگزین.

## نکات

- رندرر با `contextIsolation: true`، `nodeIntegration: false` و `sandbox: true` اجرا می‌شود. به‌جای فعال کردن Node در صفحه، پل preload را گسترش دهید.
- preload باید CommonJS بماند؛ preload به‌صورت ESM و در حالت sandbox بی‌صدا اجرا نمی‌شود.
- در `vite.config.ts` مقدار `base: "./"` تنظیم شده است. برنامهٔ بسته‌بندی‌شده `dist/index.html` را از طریق `file://` باز می‌کند و مسیرهای مطلق `/assets/...` به ریشهٔ درایو اشاره می‌کنند و پنجره سفید می‌ماند. به همین دلیل در `src/main.tsx` از `HashRouter` استفاده می‌شود، نه `BrowserRouter`.
- هیچ فیلدی در فرم یادداشت `placeholder` ندارد، چون هر دو فیلد `FieldLabel` دارند.
- عنوان یادداشت همیشه اجباری است و متن اختیاری؛ هر دو محدودیت طول دارند (عنوان ۱۲۰ و متن ۵۰۰۰ کاراکتر). `electron/db.mjs` همین قواعد را دوباره بررسی می‌کند، چون رندرر مورد اعتماد نیست.
- `src/components/ui/**` از Prettier و oxlint مستثنا شده تا به‌روزرسانی‌های shadcn با قالب‌بندی محلی تضاد پیدا نکنند. هر تغییری در این پوشه با `bunx shadcn@latest` انجام شود، وگرنه بازنویسی می‌شود.

</div>
