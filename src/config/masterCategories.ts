import masterCategoriesData from './master_categories.json';

export interface SectionRatioContract {
  ratio_range: [number, number];
  default_30_cuts?: string;
  role: string;
}

export interface FormatContract {
  format_id: string;
  name_ja: string;
  default_cuts: number;
  min_cuts?: number;
  max_cuts?: number;
  target_duration_sec?: number;
  duration_sec_per_cut?: number;
  recommended_aspect_ratio: string;
  section_ratio_allocation?: Record<string, SectionRatioContract>;
  audio_role: string;
  story_role: string;
  visual_role: string;
}

export interface SubStyleContract {
  name: string;
  bpm: number;
}

export interface PoolContract {
  pool_code: number;
  name_ja: string;
  taste_key: string;
  story_contract: {
    themes: string[];
    banned_words: string[];
  };
  audio_contract: {
    default_bpm: number;
    bpm_range: string;
    sound_texture: string;
    sub_styles?: Record<string, SubStyleContract>;
  };
  visual_contract: {
    style_preset: string;
    prompt_prefix: string;
  };
}

export interface MasterCategoriesManifest {
  schema_version: string;
  document_title: string;
  effective_date: string;
  architecture_execution_policy?: Record<string, unknown>;
  system_runtime_policy?: {
    description?: string;
    scaling_rules?: {
      cut_count_override_allowed?: boolean;
      dynamic_duration_formula?: string;
      crossfade_transition_sec?: number;
      veo_base_clip_sec?: number;
      base_fps?: number;
      file_naming_convention?: string;
    };
    vertex_ai_rate_limit_policy?: {
      max_concurrency?: number;
      default_pacing_delay_sec?: number;
      min_pacing_delay_sec?: number;
      retry_backoff_sec?: number[];
      region_failover_order?: string[];
    };
  };
  formats: Record<string, FormatContract>;
  lyric_rules: Record<string, string>;
  pools: PoolContract[];
}

export const MASTER_CATEGORIES: MasterCategoriesManifest = masterCategoriesData as unknown as MasterCategoriesManifest;

/**
 * pool_codeから該当プールのコントラクトを取得
 */
export function getPoolContract(poolCode: number): PoolContract | undefined {
  return MASTER_CATEGORIES.pools.find(p => p.pool_code === poolCode);
}

/**
 * テーマ文字列および制作モードから、最適な 10刻み pool_code, 1刻み style_code, format_id を自動解決
 */
export function resolveMasterCategory(theme?: string, mode?: string): {
  pool_code: number;
  style_code: number;
  format_id: 'music_mv' | 'drama_manga' | 'trivia_shorts';
  pool: PoolContract;
} {
  const t = (theme || '').toLowerCase();
  const m = (mode || '').toLowerCase();

  // 1. フォーマットの解決
  let format_id: 'music_mv' | 'drama_manga' | 'trivia_shorts' = 'drama_manga';
  if (m === 'mv' || t.includes('mv') || t.includes('音楽') || t.includes('歌')) {
    format_id = 'music_mv';
  } else if (m === 'trivia' || t.includes('雑学') || t.includes('解説') || t.includes('shorts')) {
    format_id = 'trivia_shorts';
  } else {
    format_id = 'drama_manga';
  }

  // 2. 9大プールの解決 (10〜90)
  let pool_code = 20; // デフォルト: 日常・アオハル
  let style_code = 21;

  if (m === 'craft' || t.includes('職人') || t.includes('工芸') || t.includes('刀鍛冶') || t.includes('陶芸') || t.includes('手仕事') || t.includes('超絶技巧')) {
    pool_code = 90;
    style_code = 91;
  } else if (t.includes('バトル') || t.includes('熱血') || t.includes('格闘') || t.includes('ロック') || t.includes('勝負') || t.includes('対決')) {
    pool_code = 80;
    style_code = 81;
  } else if (t.includes('ファンタジー') || t.includes('異世界') || t.includes('古代遺跡') || t.includes('エルフ') || t.includes('魔法') || t.includes('神話')) {
    pool_code = 70;
    style_code = 71;
  } else if (m === 'folklore' || t.includes('怪異') || t.includes('狂気') || t.includes('ホラー') || t.includes('禁足地') || t.includes('廃村') || t.includes('未解決')) {
    pool_code = 60;
    style_code = 61;
  } else if (t.includes('江戸') || t.includes('大河') || t.includes('和風') || t.includes('城下町') || t.includes('武将') || t.includes('浮世絵') || t.includes('歴史')) {
    pool_code = 50;
    style_code = 51;
  } else if (t.includes('ノワール') || t.includes('探偵') || t.includes('裏路地') || t.includes('ダーク') || t.includes('サスペンス') || t.includes('紫煙')) {
    pool_code = 40;
    style_code = 41;
  } else if (t.includes('サイバー') || t.includes('近未来') || t.includes('電脳') || t.includes('ai') || t.includes('シンセ') || t.includes('ネオン')) {
    pool_code = 30;
    style_code = 31;
  } else if (t.includes('切ない') || t.includes('哀愁') || t.includes('別れ') || t.includes('雨宿り') || t.includes('夕暮れ') || t.includes('涙')) {
    pool_code = 10;
    style_code = 11;
  } else {
    // 日常・アオハル (20)
    pool_code = 20;
    style_code = format_id === 'trivia_shorts' ? 24 : 21;
  }

  const pool = getPoolContract(pool_code) || MASTER_CATEGORIES.pools[1]; // fallback 20

  return {
    pool_code,
    style_code,
    format_id,
    pool
  };
}
