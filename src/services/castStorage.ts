import { MangaProject, CastCharacter, ExpressionType, CastExpression } from '../types';

const STORAGE_KEY = 'flowtool_manga_project_v5';
const OLD_STORAGE_KEYS = ['flowtool_manga_project_v4', 'flowtool_manga_project_v3', 'flowtool_manga_project_v2', 'flowtool_manga_project_v1'];

export const EXPRESSION_METAS: Record<ExpressionType, { label: string; promptModifierEn: string; icon: string }> = {
  neutral: { 
    label: '通常 (Neutral)', 
    promptModifierEn: 'neutral calm expression, steady confident gaze, sharp facial features', 
    icon: 'sentiment_neutral' 
  },
  happy: { 
    label: '笑顔 (Happy)', 
    promptModifierEn: 'bright gentle smile, warm happy eyes, cheerful friendly expression', 
    icon: 'sentiment_satisfied' 
  },
  angry: { 
    label: '怒り (Angry)', 
    promptModifierEn: 'intense angry expression, sharp piercing glare, furrowed brows, gritted teeth, fierce battle focus', 
    icon: 'mood_bad' 
  },
  sad: { 
    label: '哀愁 (Sad)', 
    promptModifierEn: 'sorrowful melancholy expression, downcast eyes, gentle poignant sadness', 
    icon: 'sentiment_dissatisfied' 
  },
  surprised: { 
    label: '驚愕 (Surprised)', 
    promptModifierEn: 'wide astonished eyes, gasp of shock, startled dynamic expression', 
    icon: 'sentiment_very_dissatisfied' 
  },
  smirk: { 
    label: '不敵 (Smirk)', 
    promptModifierEn: 'daring smirk, sly confident grin, sharp side-glance, charming cool aura', 
    icon: 'sentiment_very_satisfied' 
  },
};

export function createDefaultExpressions(): Record<ExpressionType, CastExpression> {
  const exps: any = {};
  (Object.keys(EXPRESSION_METAS) as ExpressionType[]).forEach((key) => {
    exps[key] = {
      type: key,
      label: EXPRESSION_METAS[key].label,
      promptModifierEn: EXPRESSION_METAS[key].promptModifierEn,
    };
  });
  return exps as Record<ExpressionType, CastExpression>;
}

export function createDefaultCastCharacter(
  id: string, 
  name: string, 
  role: CastCharacter['role'], 
  dnaPromptEn: string
): CastCharacter {
  return {
    id,
    name,
    role,
    dnaPromptEn,
    expressions: createDefaultExpressions(),
  };
}

export const DEFAULT_MANGA_PROJECT: MangaProject = {
  id: 'project_default',
  title: '新選組・壬生浪士の挽歌（オリジナル連載）',
  description: '幕末京都を舞台に繰り広げられる3人の剣士と女密偵の歴史ドラマ',
  activeCharacterId: 'char_1',
  updatedAt: new Date().toISOString(),
  characters: [
    createDefaultCastCharacter(
      'char_1',
      '主人公 (沖田)',
      'protagonist',
      'A young handsome samurai with dark topknot, sharp jawline, wearing indigo haori with white dandaraya zig-zag pattern, holding katana'
    ),
    createDefaultCastCharacter(
      'char_2',
      '相棒・密偵 (千代)',
      'partner',
      'A graceful beautiful young woman with dark silky hair tied with crimson ribbon, piercing emerald eyes, wearing elegant noir kimono'
    ),
    createDefaultCastCharacter(
      'char_3',
      '宿敵 (芹沢)',
      'antagonist',
      'A menacing cold swordsman with silver-streaked hair, scar across left cheek, fierce golden eyes, wearing midnight black haori'
    ),
    createDefaultCastCharacter(
      'char_witch',
      '猫耳魔女 (ルナ)',
      'protagonist',
      'A cute young anime witch girl with fluffy cat ears and long messy light ash-blonde hair, large gentle golden-yellow eyes, slightly pouty expression, wearing a dark oversized witch hat decorated with ribbons and a bell, dark hooded witch cloak, dark gothic dress, striped thigh-high socks, heavy lace-up combat boots, fluffy dark cat tail'
    ),
    createDefaultCastCharacter(
      'char_cruise_lady',
      'バーの麗人・セリア (猫耳セレブ)',
      'protagonist',
      'A glamorous slender kemonomimi woman with cat ears and flowing blonde hair, elegant 6-head-tall mature proportions, sleek jawline, alluring expressive almond-shaped eyes with vivid crimson irises, wearing an exquisite modern cocktail dress with fine lace fabric texture, shimmering jewelry, sophisticated beauty'
    ),
    createDefaultCastCharacter(
      'char_jazz_noir',
      'バーの小悪魔・ノワール (黒髪猫耳)',
      'protagonist',
      'A gorgeous alluring catgirl with short messy jet-black hair and fluffy cat ears, sharp delicate V-shaped chin and slender jawline, mesmerizing almond-shaped eyes with thick dark upper eyeliner and glowing deep ruby-red irises, seductive teasing half-smile, wearing a chic off-shoulder black dress and ornate gold rings, mature seductive charm'
    ),
    createDefaultCastCharacter(
      'char_squirrel_witch',
      'リス魔女 (パッツンジト目)',
      'protagonist',
      'A tiny chubby young anime witch girl with blunt straight-cut fringe bangs, messy longer light ash-blonde hair, large half-closed drowsy unamused sullen teal-blue eyes, slightly grumpy pouty expression, two large fluffy furry animal ears sprouting naturally from head sides below hat brim, a massive bushy heavily textured furry squirrel tail, oversized floppy dark purple-black witch hat decorated with gold stars and large ribbon badge, roomy dark hooded witch cloak, dark dress, patterned tights, chunky lace-up boots'
    ),
    createDefaultCastCharacter(
      'char_pouty_squirrel_witch',
      'リス魔女 (パッツンジト目・単一尻尾固定)',
      'protagonist',
      'A tiny chubby young anime witch girl with blunt straight-cut fringe bangs, messy spiky ash-blonde hair, large half-closed drowsy unamused sullen teal-blue eyes, slightly grumpy cynical pout, two large fluffy furry animal ears sprouting naturally from head sides, strictly ONE single massive bushy heavily textured furry squirrel tail curving to the right side (strictly one tail, asymmetrical), oversized floppy dark witch hat decorated with gold stars and ribbon badge, dark hooded witch cloak, dark dress, chunky boots'
    ),
  ],
};

/**
 * LocalStorage からプロジェクトをロード
 */
export function loadMangaProject(): MangaProject {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const oldKey of OLD_STORAGE_KEYS) {
        raw = localStorage.getItem(oldKey);
        if (raw) break;
      }
    }

    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MANGA_PROJECT));
      return { ...DEFAULT_MANGA_PROJECT };
    }
    const parsed = JSON.parse(raw);
    if (!parsed.characters || !Array.isArray(parsed.characters) || parsed.characters.length === 0) {
      return { ...DEFAULT_MANGA_PROJECT };
    }

    // デフォルトキャラ（新追加キャラ含む）が既存プロジェクトに無ければ安全に追記
    const existingIds = new Set(parsed.characters.map((c: CastCharacter) => c.id));
    let hasNew = false;
    for (const defChar of DEFAULT_MANGA_PROJECT.characters) {
      if (!existingIds.has(defChar.id)) {
        parsed.characters.push(defChar);
        hasNew = true;
      }
    }
    if (hasNew) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed as MangaProject;
  } catch (e) {
    console.warn('Failed to load manga project from localStorage', e);
    return { ...DEFAULT_MANGA_PROJECT };
  }
}

/**
 * LocalStorage へプロジェクトを保存
 */
export function saveMangaProject(project: MangaProject): void {
  try {
    const toSave: MangaProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save manga project to localStorage', e);
  }
}

/**
 * プロジェクト全体（キャラ画像base64を含む）を JSON ファイルとしてダウンロード
 */
export function exportProjectJson(project: MangaProject): void {
  const filename = `manga_project_${(project.title || 'untitled').replace(/[\s/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * JSON ファイルを読み込んで MangaProject オブジェクトを復元
 */
export function importProjectJson(file: File): Promise<MangaProject> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      return reject(new Error('JSONファイルを選択してください'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.characters || !Array.isArray(parsed.characters)) {
          throw new Error('有効なプロジェクト形式ではありません（characters 配列がありません）');
        }
        resolve(parsed as MangaProject);
      } catch (err: any) {
        reject(new Error(`JSONの解析に失敗しました: ${err?.message || err}`));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsText(file);
  });
}
