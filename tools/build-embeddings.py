"""Сборка компактного файла эмбеддингов для бота-капитана Коднеймс."""
import base64, json, re, sys
import numpy as np
from navec import Navec
from wordfreq import top_n_list
import pymorphy3

NAVEC_PATH = 'navec_hudlit_v1_12B_500K_300d_100q.tar'
DICT_TS = 'packages/shared/src/codenames/dictionary.ts'
OUT = 'packages/shared/src/codenames/embeddings.data.json'

def board_words():
    src = open(DICT_TS, encoding='utf8').read()
    body = re.search(r'CODENAMES_WORDS_RU.*?=\s*\[(.*?)\];', src, re.S).group(1)
    return re.findall(r"'([^']+)'", body)

def main():
    navec = Navec.load(NAVEC_PATH)
    morph = pymorphy3.MorphAnalyzer()
    board = board_words()
    print('board words:', len(board))

    def vec(word):
        parts = word.split()
        vs = [navec[p] for p in parts if p in navec]
        if not vs: return None
        return np.mean(vs, axis=0)

    missing = [w for w in board if vec(w) is None]
    print('missing in navec:', missing)

    # Кандидаты-подсказки: частотные русские существительные в нормальной форме.
    cands, seen = [], set(board)
    for w in top_n_list('ru', 50000):
        if len(cands) >= 2500: break
        if not re.fullmatch(r'[а-яё]{3,14}', w): continue
        p = morph.parse(w)[0]
        if p.tag.POS != 'NOUN' or p.normal_form != w: continue
        if w in seen or w not in navec: continue
        seen.add(w)
        cands.append(w)
    print('candidates:', len(cands))

    words = board + cands
    mat = np.stack([vec(w) for w in words if vec(w) is not None])
    kept = [w for w in words if vec(w) is not None]
    # нормализуем для косинуса, квантуем в int8
    mat = mat / np.linalg.norm(mat, axis=1, keepdims=True)
    q = np.clip(np.round(mat * 127), -127, 127).astype(np.int8)
    data = base64.b64encode(q.tobytes()).decode()
    json.dump({
        'dims': int(mat.shape[1]),
        'boardCount': len([w for w in board if w in kept or vec(w) is not None]),
        'words': kept,
        'vectors': data,
    }, open(OUT, 'w', encoding='utf8'), ensure_ascii=False)
    print('written', OUT, 'words:', len(kept), 'bytes:', len(data))

main()
