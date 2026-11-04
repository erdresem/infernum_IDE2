# Infernum IDE — сборка через GitHub Actions без Node.js на компьютере

## Вариант A: загрузить проект целиком

1. Скачайте `infernum-ide-github-build-kit-v0.1.2-root.zip`.
2. Распакуйте архив. Внутри сразу должны находиться `package.json`, `scripts/`, `extensions/` и скрытая папка `.github/`. Не загружайте внешнюю папку-обёртку.
3. На GitHub создайте репозиторий `Infernum-IDE`.
4. На вкладке **Code** нажмите **Add file → Upload files**.
5. Перетащите ВСЁ содержимое распакованной папки, включая `.github`. Если папка `.github` не видна в диалоге выбора файлов, включите показ скрытых элементов или используйте вариант B ниже.
6. Нажмите **Commit changes** в default branch (`main`).
7. Откройте **Actions**. Слева должен появиться workflow **Build Infernum IDE Portable**. Если его нет и GitHub предлагает шаблоны, значит workflow YAML не попал в репозиторий по точному пути `.github/workflows/build-portable.yml`. Используйте вариант B.

## Вариант B: создать workflow прямо на GitHub (надёжный способ)

1. В репозитории откройте **Code → Add file → Create new file**.
2. В поле имени файла вставьте ровно: `.github/workflows/build-portable.yml`
3. Откройте приложенный отдельно файл `build-portable.yml`, скопируйте всё содержимое и вставьте в редактор GitHub.
4. Нажмите **Commit changes** именно в default branch (`main`).
5. Откройте **Actions**. Теперь в левом списке появится **Build Infernum IDE Portable**. Откройте его и нажмите **Run workflow → Run workflow**.

## Где скачать готовые приложения

Откройте завершённый запуск workflow и в самом низу страницы найдите **Artifacts**:

- `Infernum-IDE-Windows-x64-Portable` — ZIP для Windows x64.
- `Infernum-IDE-Linux-x64-Portable` — TAR.GZ для Linux x64.

GitHub устанавливает Node.js, pnpm, Python, Rust и компиляторы только на своих runner-машинах. На вашем ПК нужен только браузер.

## Если workflow не запускается

- Проверьте, что файл лежит именно в `.github/workflows/build-portable.yml` (не `github/workflows`, не `workflows/build-portable.yml`, не внутри ещё одной папки `Infernum-IDE`).
- Убедитесь, что файл закоммичен в default branch.
- После загрузки YAML обновите страницу Actions.
- Если репозиторий принадлежит организации, администратор мог отключить GitHub Actions.
- Запуск workflow может занять продолжительное время, так как GitHub собирает VS Code OSS из исходников.
