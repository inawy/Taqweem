# دليل أندرويد وGoogle Play — من الصفر إلى المتجر

**لمن:** أي وكيل أو شخص يريد إصدار تطبيق ناوي (هذا أو غيره) على أندرويد. كل ما هنا **جُرّب فعلًا** في تقويم ما لم يُذكر أنه «لم يُتحقق». القرارات وتاريخها في `DECISIONS.md` (D-161 … D-173). ابدأ من «قائمة تطبيق جديد» في الآخر، ولا تعد اكتشاف ما هنا.

## 0) قواعد بيئة العمل (تفادي ضياع الوقت)
- **لا شيء يعمل محليًا:** لا `npm ci` ناجح، لا KVM، لا Android SDK (التحميلات محجوبة). كل التجارب في **GitHub Actions**. الحلقة: فرع `native-*` أو أي فرع ← push ← انتظر CI ← أصلح ← ادمج `--ff-only` في `main` ← push.
- **`gh api` يعمل**؛ المحجوب: GraphQL (`gh release view`، استعمل `gh api repos/…/releases/tags/…`)، وتنزيل artifacts، و**أسرار Actions** (`gh secret set` يفشل 403). لا تحاول التفافًا.
- **workflow_dispatch:** الملف يجب أن يكون في `main` أولًا ليُعرَف؛ بعدها يمكن `-f ref=<فرع>`. الأمر: `gh api -X POST repos/OWNER/REPO/actions/workflows/FILE.yml/dispatches -f ref=main`.
- **نتائج التجارب تُقرأ من اللوج:** `gh run view ID --log` ثم `grep`. لذلك كل سكربت اختبار يطبع نتائجه (`[e2e] …`).
- **التنسيق:** Prettier بعرض 100 ولا يمكن تشغيله محليًا؛ اكتب بتنسيقه يدويًا (يضم ما يتسع في سطر واحد). افحص `awk 'length>100'` على ما كتبت. الفشل في CI يطبع diff فاقرأه.
- **`package-lock.json`:** `lockfile-sync.yml` يولّده ويرفعه على فروع `native-*`؛ commits الـbot لا تشغّل CI فادفع commit فارغًا بعدها.
- **المستخدم لا يجرّب كثيرًا ولا يحب ذلك.** جرّب أنت في المحاكي (§3) وأعطه نسخة واحدة جاهزة ورابطًا، وأي تشخيص داخل التطبيق.

## 1) البنية
- **Capacitor 8** يلفّ تطبيق الويب. مجلد `android/` **يُولَّد في CI** بـ`npx cap add android` ولا يُرفَع للمستودع (`/android/` في `.gitignore` — بشرطة أولى! `android/` بلا شرطة يخفي `tools/android/`).
- ترتيب خطوات البناء (كل workflow): `checkout` ← node 22 ← java temurin 21 ← `npm ci` ← `npm run build` ← `npx cap add android` ← **أيقونات** (§5) ← **`patch_manifest.py`** ← (للإصدار: **`patch_gradle.py`**) ← `npx cap sync android` ← `./gradlew assembleDebug|bundleRelease`.
- الملفات: `capacitor.config.json` (`appId`, `appName`, `webDir: dist`, إعداد LocalNotifications)، `tools/android/{patch_manifest.py,patch_gradle.py,res/,emulator_test.*,debug.keystore}`، `.github/workflows/{android,android-emulator,android-release}.yml`.
- **`appId` لا يتغير بعد أول رفع على Play.** في تقويم اختار صاحب المشروع `taqweem.nawy.app` (بترتيب الدومين لا معكوسًا)؛ صالح تقنيًا. قرّر بوضوح قبل أول رفع.
- طبقات الكود: المنطق في `core`/`features` (مثل `features/reminders/plan.ts`: يحسب ماذا يُجدول، خالص بلا Capacitor)، والاتصال بالهاتف في `src/app/native/*` فقط (`scheduler.ts` يستورد الإضافة ديناميكيًا). الواجهة تعرف واجهة `ReminderScheduler` لا Capacitor، فتُختبر بمزيّف.

## 2) التذكيرات المحلية (بلا خادم) — ما تعلّمناه بالألم
1. **عيب Capacitor القاتل:** لا تُعِد كائن الإضافة من `async`/`.then`. كائن الإضافة proxy يردّ على أي خاصية ومنها `then`، فيستدعيها الـpromise وتفشل بـ`"X.then() is not implemented on android"`. **الحل:** `return { notifications: loaded.LocalNotifications }` ثم فكّ التغليف. مع اختبار بكائن مزيّف له `then` يرمي (`tests/app/capacitorScheduler.test.ts`). هذا العيب جعل كل جدولة تفشل بصمت أيامًا.
2. **لا تبتلع الأخطاء.** `useReminderSync` يعرض نص خطأ الهاتف في شريط. وبعد `schedule` استدعِ `getPending()` وقارن العدد وارمِ خطأ إن نقص.
3. **أذونات المانيفست** (`patch_manifest.py`): `POST_NOTIFICATIONS`، `USE_EXACT_ALARM`، `SCHEDULE_EXACT_ALARM` (`maxSdkVersion=32`)، `RECEIVE_BOOT_COMPLETED`. وثائق أندرويد: `USE_EXACT_ALARM` لتطبيقات المنبّه/التقويم، يُمنح عند التثبيت (Android 13+). **قبول Play له لم يُتحقق.**
4. **التصميم:** يلغى الجدولة كلها ويعيدها (`replaceAll`)؛ نافذة 14 يومًا وحدّ 50؛ معرّفات FNV-1a 31 بت مع تفادي التصادم؛ قناة إشعار `reminders` بأهمية 4؛ `allowWhileIdle`. التذكير حقل اختياري `reminderMinutes` على الحدث + إعداد «تذكير الحدث الجديد» (افتراضي 10 د) — **بدون افتراضي لن يصل شيء** لأن الناس لا يختارون تذكيرًا (D-166).
5. **لا تُحِل المستخدم لتطبيق آخر** (ملف .ics) داخل التطبيق الأصلي؛ هو جاء ليستعمل تطبيقك (D-167).
6. **تشخيص داخل التطبيق** (`ReminderDiagnostics.tsx`): الإذن، المنبّه الدقيق، عدد المجدولة، زر إشعار تجريبي، **رقم النسخة (`BUILD_INFO.sha`)**، مهلة 10 ث «الهاتف لم يردّ». أي زر يجب أن يردّ دائمًا.
7. **حدود لم تُتحقق:** سلوك إعادة تشغيل الهاتف، توفير بطارية سامسونج على المدى الطويل، حدّ 64 تذكيرًا على iOS (من الذاكرة). iOS مؤجَّل.

## 3) الاختبار في محاكي (الأهم: لا تجرّب على هاتف المستخدم)
`android-emulator.yml` (يدوي، مصفوفة API 34 و35): يبني APK ثم `reactivecircus/android-emulator-runner@v2` (`x86_64`, `google_apis`) بعد خطوة تفعيل KVM (udev). السكربتات:
- `emulator_test.sh`: `adb install` ← `pm grant POST_NOTIFICATIONS` ← تشغيل `$PKG/.MainActivity` ← `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` ← `node emulator_test.mjs`.
- `emulator_test.mjs`: يتصل بالـWebView عبر **CDP بـWebSocket خام** (`fetch http://127.0.0.1:9222/json` ثم `new WebSocket(...)`، عقدة 22 فيها WebSocket)، ويقود الواجهة بـJS (`Runtime.evaluate`): ضبط قيم React بالـnative setter + `input`/`change` events، ثم ينشئ حدثًا بعد دقيقتين بتذكير 0، يضغط «فحص» و«تذكير تجريبي»، وينتظر. **التحقق** من `adb shell dumpsys notification --noredact` بحثًا عن `android.title=String (…)`؛ يخرج `1` إن غاب أيٌّ منهما.
- **لا تستعمل Playwright `connectOverCDP`** مع WebView: فشل. لا تنسَ `WebView debugging` (مفعّل في بناء debug).
- **ما لا يثبته المحاكي:** قيود بطارية سامسونج/شاومي وغيرها. يثبت منطق التطبيق والجدولة فقط.
- النتيجة تُقرأ من اللوج (`grep "\[e2e\]"`)؛ لا تنتظر artifacts.

## 4) التوقيع والنسخ
- **نسخة التجربة (debug APK):** `android.yml` على فروع `native-*` أو يدويًا، ينشر Release `android-debug` (prerelease) يُستبدل كل مرة. **مفتاح debug ثابت** في `tools/android/debug.keystore` (يُنسخ إلى `~/.android/` قبل البناء) وإلا رُفض كل تحديث بـ«App not installed» لاختلاف التوقيع (D-164). علني عمدًا؛ **لا يُستعمل أبدًا للمتجر**. تغيير `appId` = تطبيق جديد جانبي (يُمسح القديم يدويًا).
- **إصدار Play (AAB):** `android-release.yml` يدوي. **ثلاثة أسرار** يضيفها المالك يدويًا (لا نستطيع): `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`. المفتاح PKCS12 بكلمة واحدة (`keytool -genkeypair -storetype PKCS12 … -validity 10000`). سلّم المالك الملف `.p12` وقيم الأسرار **مرة واحدة** في المحادثة ليحتفظ بنسخة، ولا تضعها في المستودع. نعتمد **Play App Signing**: مفتاحنا «مفتاح رفع» قابل للاستبدال عبر دعم Play.
  - **خطأ وقعنا فيه:** فكّ المفتاح قبل `checkout` يمسحه (checkout ينظّف). افكّه **بعد** `checkout`.
  - `patch_gradle.py`: يضبط `versionCode`/`versionName` ويضيف `signingConfigs.release` من متغيرات البيئة، ويفشل بصوت عالٍ إن تغيّر شكل `build.gradle`. `versionCode = github.run_number` (يزيد دائمًا)، `versionName = 1.0.<run>`.
  - يخرج Release **مسودّة** بملف `taqweem-<ver>.aab`. وفي `android.yml` **تجربة جافة** للإصدار بمفتاح مؤقت تكشف كسر الإصدار مبكرًا.
- بعد كل تغيير مهم أعد بناء الـAPK والـAAB (`dispatch`) وأخبر المستخدم بالرابط.

## 5) الأيقونات (D-171)
المولّد `python3 tools/icons/make_icons.py --all .` (Pillow + Playwright) يكتب: أيقونات الويب (`public/icons`)، وموارد أندرويد `tools/android/res` (legacy `mipmap-*`، **adaptive** foreground/monochrome، أيقونة الإشعار `drawable-*/ic_stat_*.png`)، وصورة Play 512. `make_feature.py` يولّد الصورة المميّزة 1024×500.
- **في CI** (قبل `cap sync`): احذف `ic_launcher*` الافتراضية و`drawable/ic_launcher_background.xml` و`drawable-v24/ic_launcher_foreground.xml` ثم انسخ `tools/android/res/.` وإلا حدث تعارض موارد مكرّرة.
- إعداد الإشعار: `plugins.LocalNotifications.smallIcon` في `capacitor.config.json`.
- الخلفية `#111318`. الرقم في أيقونة التقويم ثابت (أيقونة تتغير يوميًا هشّة على أندرويد وغير ممكنة على iOS). **لا خط:** الأرقام مرسومة كأشكال؛ لقراءة أوضح في 48px استُعملت نسخة «صغيرة بصريًا».

## 6) Google Play
- **سياسة الخصوصية** صفحة ثابتة (`public/privacy.html`) على نطاق التطبيق. **انتبه:** الـservice worker كان يردّ بالتطبيق على كل تصفّح فتُفتح صفحة التطبيق بدل الصفحة؛ استُثنيت في `tools/vite/sw.template.js` (D-173). أي صفحة ثابتة جديدة تحتاج نفس الاستثناء + اختبار.
- **حساب شخصي جديد:** اختبار مغلق بـ**12 مختبِرًا × 14 يومًا متواصلة** قبل الإنتاج ([صفحة دعم Play](https://support.google.com/googleplay/android-developer/answer/14151465)). الخطة والرسالة والجدول: `CLOSED_TEST.md`. ابدأ مبكرًا فهو الاختناق.
- نصوص المتجر، «أمان البيانات»، التصنيف، قائمة قبل الرفع: `PLAY_LISTING.md`. **ملء نماذج Play وتسجيل الحساب والرفع والتوثيق على المالك**، لا نستطيع من هنا.
- الصدق: لا تذكر في وصف المتجر ميزة غير موجودة؛ طابق كل بند بالتطبيق.

## قائمة تطبيق ناوي جديد (انسخ من تقويم)
1. قرّر `appId` و`appName` نهائيًا؛ ضعهما في `capacitor.config.json`.
2. انسخ: `tools/android/` (بدّل `PKG` في `emulator_test.sh` وعناصر الواجهة في `emulator_test.mjs`)، `tools/icons/` (غيّر الرقم/الألوان)، الـworkflows الثلاثة + `lockfile-sync.yml` + `check-lockfile.sh`، `src/app/native/` و`src/features/reminders/` إن كان فيه تذكيرات.
3. أنشئ مفتاح debug ثابتًا ومفتاح رفع جديدًا **لكل تطبيق** (لا تُعد استعمال مفتاح تقويم).
4. اجعل `.gitignore` فيه `/android/`.
5. شغّل: debug APK ← المحاكي (34+35) ← أعطِ المستخدم رابطًا واحدًا. لا تطلب منه تجربة قبل نجاح المحاكي.
6. أنشئ الأسرار الثلاثة (المالك) ← `android-release` ← مسودّة AAB.
7. صفحة الخصوصية + استثناء الـSW، `PLAY_LISTING.md`، `CLOSED_TEST.md` للتطبيق الجديد.
8. سجّل كل قرار في `DECISIONS.md` بالتسلسل.

## أخطاء تكرّرت — لا تعدها
| العرَض | السبب | الحل |
|---|---|---|
| التذكير لا يصل والتطبيق صامت | `then()` على كائن الإضافة (§2) | غلّف الكائن؛ اعرض الأخطاء |
| «التطبيق لم يُثبَّت» عند التحديث | مفتاح debug يتغير | مفتاح ثابت (§4) |
| الإصدار: «keystore not found» | فكّ المفتاح قبل checkout | بعده |
| `tools/android` لا يُرفع | `.gitignore` بـ`android/` | `/android/` |
| صفحة الخصوصية تفتح التطبيق | service worker | استثناء (§6) |
| الحدث بلا تذكير | الافتراضي «بلا تذكير» | إعداد افتراضي (D-166) |
| `gh secret set` يفشل | البروكسي يحجب | المالك يضيفها يدويًا |
| فشل Prettier | سطر يُضمّ أو يتجاوز 100 | انظر diff CI |
