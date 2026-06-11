# CI

GitHub-токен интеграции не имеет права `workflows`, поэтому файл экшена нельзя запушить автоматически.

Чтобы включить CI, один раз скопируйте `ci/github-actions-ci.yml` в `.github/workflows/ci.yml`
через веб-интерфейс GitHub (Add file → Create new file) или локально.
