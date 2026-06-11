# tools

## build-embeddings.py

Пересборка `packages/shared/src/codenames/embeddings.data.json` (векторы слов для бота-капитана).

```bash
pip install navec wordfreq pymorphy3 numpy
curl -LO https://storage.yandexcloud.net/natasha-navec/packs/navec_hudlit_v1_12B_500K_300d_100q.tar
python tools/build-embeddings.py
```

Запускать только при изменении словаря (`dictionary.ts`) или списка кандидатов.
