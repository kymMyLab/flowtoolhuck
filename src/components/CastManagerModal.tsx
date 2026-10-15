import React, { useState, useRef } from 'react';
import { MangaProject, CastCharacter, ExpressionType, CastExpression, MangaStoryConcept } from '../types';
import { EXPRESSION_METAS, createDefaultCastCharacter, exportProjectJson, importProjectJson } from '../services/castStorage';
import { SectionLabel } from './Primitives';
import { Flow } from 'flow-sdk';
import { resolveImageModel } from '../constants';
import { safeJsonParse, callWithRetry, formatErrorMessage, formatDataUri } from '../services/utils';
import { CastTabsBar } from './cast/CastTabsBar';
import { CastBrainstormModal } from './cast/CastBrainstormModal';
import { CastImageZoomModal } from './cast/CastImageZoomModal';

interface CastManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: MangaProject;
  onUpdateProject: (updated: MangaProject) => void;
  onApplyCharacterToVault: (character: CastCharacter, expressionType?: ExpressionType) => void;
  onAddLog: (msg: string, type?: any) => void;
  currentTaste?: string;
  onOpenComicWizard?: () => void;
}

const toImageSrc = (img?: string): string => {
  return formatDataUri(img);
};

export const CastManagerModal: React.FC<CastManagerModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
  onApplyCharacterToVault,
  onAddLog,
  currentTaste,
  onOpenComicWizard,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>(
    project.activeCharacterId || project.characters[0]?.id || 'char_kemomimi_jk'
  );
  const [generatingExp, setGeneratingExp] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isGeneratingTurnaround, setIsGeneratingTurnaround] = useState(false);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormConcepts, setBrainstormConcepts] = useState<MangaStoryConcept[] | null>(null);
  const [zoomImage, setZoomImage] = useState<{ base64: string; title: string; prompt?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetExpRef = useRef<ExpressionType | 'turnaround' | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const projectRef = useRef(project);
  projectRef.current = project;

  const selectedCharIdRef = useRef(selectedCharId);
  selectedCharIdRef.current = selectedCharId;

  if (!isOpen) return null;

  const currentChar = project.characters.find(c => c.id === selectedCharId) || project.characters[0];

  // キャラクターの更新（最新の projectRef から確実にマージ）
  const updateCurrentChar = (patch: Partial<CastCharacter>) => {
    const curProject = projectRef.current;
    const curCharId = selectedCharIdRef.current;
    const targetChar = curProject.characters.find(c => c.id === curCharId) || curProject.characters[0];
    if (!targetChar) return;

    const updatedChars = curProject.characters.map(c => 
      c.id === targetChar.id ? { ...c, ...patch } : c
    );
    const newProject = { ...curProject, characters: updatedChars };
    projectRef.current = newProject;
    onUpdateProject(newProject);
  };

  // 表情プロンプト・画像の更新
  const updateExpression = (expType: ExpressionType, patch: Partial<CastExpression>) => {
    const curProject = projectRef.current;
    const curCharId = selectedCharIdRef.current;
    const targetChar = curProject.characters.find(c => c.id === curCharId) || curProject.characters[0];
    if (!targetChar) return;

    const updatedExpressions = {
      ...targetChar.expressions,
      [expType]: { ...targetChar.expressions[expType], ...patch }
    };
    // 通常(neutral)の画像が更新された場合、アバター画像も自動更新
    const avatarBase64 = expType === 'neutral' && patch.imageBase64 !== undefined 
      ? patch.imageBase64 
      : targetChar.avatarBase64;

    updateCurrentChar({ expressions: updatedExpressions, avatarBase64 });
  };

  // 新規キャラクターの追加
  const handleAddCharacter = () => {
    if (project.characters.length >= 6) {
      onAddLog('⚠️ キャラクターは最大6人まで登録可能です', 'warning');
      return;
    }
    const newIdx = project.characters.length + 1;
    const newChar = createDefaultCastCharacter(
      `char_${Date.now()}`,
      `新キャラクター ${newIdx}`,
      'supporting',
      'A character with distinctive hair style, expressive eyes, stylish attire'
    );
    const updated = {
      ...project,
      characters: [...project.characters, newChar],
      activeCharacterId: newChar.id
    };
    onUpdateProject(updated);
    setSelectedCharId(newChar.id);
    onAddLog(`✨ 新しいキャラクター「${newChar.name}」を追加しました`, 'success');
  };

  // キャラクターの削除
  const handleDeleteCharacter = (charId: string) => {
    if (project.characters.length <= 1) {
      onAddLog('⚠️ 最低1人のキャラクターが必要です', 'warning');
      return;
    }
    const filtered = project.characters.filter(c => c.id !== charId);
    const nextSelected = filtered[0]?.id || 'char_1';
    onUpdateProject({ ...project, characters: filtered, activeCharacterId: nextSelected });
    setSelectedCharId(nextSelected);
    onAddLog('🗑️ キャラクターを削除しました', 'info');
  };

  // 画像アップロード処理
  const handleUploadImage = (file: File, target: ExpressionType | 'turnaround') => {
    if (!file.type.startsWith('image/')) {
      onAddLog('❌ 画像ファイルを選択してください', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64WithPrefix = e.target?.result as string;
      const base64 = base64WithPrefix.split(',')[1];
      if (target === 'turnaround') {
        updateCurrentChar({ turnaroundBase64: base64 });
        onAddLog(`✨ 三面図シートに手動画像を登録しました`, 'success');
      } else {
        updateExpression(target, { imageBase64: base64 });
        onAddLog(`✨ 「${EXPRESSION_METAS[target].label}」スロットに画像を登録しました`, 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  // キャラクター三面図（正面・側面・背面 / 16:9）のAI自動生成
  const handleGenerateTurnaround = async () => {
    const curProject = projectRef.current;
    const curCharId = selectedCharIdRef.current;
    const targetChar = curProject.characters.find(c => c.id === curCharId) || curProject.characters[0];
    if (!targetChar) return;

    const fullPrompt = `${targetChar.dnaPromptEn}, anime character turnaround sheet, model sheet, three views, full body front view, full body side view, full body back view, clean plain white background, high-contrast crisp anime lineart, consistent clothing and proportions, masterpiece`;
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';

    setIsGeneratingTurnaround(true);
    onAddLog(`📐 ${targetChar.name} の三面図シート（正面・側面・背面）をAI作画中...`, 'process');

    try {
      const modelDef = resolveImageModel();
      const safeModelName = modelDef?.name || '🍌 Nano Banana 2';

      const res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: fullPrompt,
          negativePrompt: safeNegative,
          aspectRatio: '16:9',
          modelDisplayName: safeModelName,
        }),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ 三面図作画リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒後... (理由: ${formatErrorMessage(err)})`, 'warning');
        },
        3
      );

      const base64 = res?.base64 || res?.image?.base64;
      const mediaId = res?.mediaId || res?.image?.mediaId;

      if (base64) {
        updateCurrentChar({
          turnaroundBase64: base64,
          turnaroundMediaId: mediaId,
          turnaroundPromptEn: fullPrompt
        });
        onAddLog(`✨ ${targetChar.name} の三面図シートが完成しました！`, 'success');
      } else {
        throw new Error('三面図データが返却されませんでした');
      }
    } catch (err: any) {
      onAddLog(`❌ 三面図作画エラー: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setIsGeneratingTurnaround(false);
    }
  };

  // 物語企画・ジャンルAIブレスト（10選）の生成
  const handleBrainstormConcepts = async () => {
    setIsBrainstorming(true);
    onAddLog(`🎲 現在の画風にマッチする「物語企画（10選）」をAIブレスト中...`, 'process');

    const tasteInstruction = currentTaste ? `\n対象の画風テイスト: 「${currentTaste}」` : '';
    const prompt = `あなたは日本屈指の敏腕漫画編集者・アニメ映画プロデューサーです。
短編読み切り漫画（1話完結 / 24カット構成）として極めて面白く、読者が引き込まれるオリジナルストーリーの企画・世界観・主要キャラクター案を【10種類】ランダムにブレストして提案してください。
${tasteInstruction}

【バリエーション豊かなジャンル網羅】
探偵・サスペンス、下町・人情日常、怪異・オカルトホラー、SFサイバー潜入、学園青春・部活、スチームパンク冒険、和風伝奇、飯テロ・職人、ファンタジー異世界、コメディなどをバランス良く盛り込んでください。

以下の厳密なJSON形式（Markdownコードブロックのない純粋なJSON配列）で出力してください:
[
  {
    "id": "concept_1",
    "genre": "🕵️‍♂️ 探偵・サスペンス",
    "title": "物語タイトル",
    "logline": "1行の魅力的なあらすじ（どんな主人公がどんな事件や非日常に巻き込まれるか）",
    "characters": [
      {
        "name": "主人公名 (肩書)",
        "role": "protagonist",
        "concept": "主人公の性格・特徴・武器など",
        "dnaPromptEn": "A detailed English character appearance prompt: gender, age, hairstyle, hair color, eye shape, eye color, distinctive facial expression, clothing, accessories"
      },
      {
        "name": "相棒/ヒロイン名 (肩書)",
        "role": "partner",
        "concept": "相棒やヒロインの性格・役割",
        "dnaPromptEn": "A detailed English character appearance prompt"
      },
      {
        "name": "宿敵/依頼人名 (肩書)",
        "role": "antagonist",
        "concept": "ライバルや謎の依頼人の設定",
        "dnaPromptEn": "A detailed English character appearance prompt"
      }
    ]
  }
]`;

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.text(prompt),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ 物語企画ブレスト リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒後... (${formatErrorMessage(err)})`, 'warning');
        },
        5
      );
      const text = res?.text || (typeof res === 'string' ? res : '');
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const concepts = safeJsonParse<MangaStoryConcept[]>(cleaned, []);
      if (Array.isArray(concepts) && concepts.length > 0) {
        setBrainstormConcepts(concepts);
        onAddLog(`✨ 10種類の物語企画アイデアが完成しました！お好きな企画を選択してください。`, 'success');
      } else {
        throw new Error('企画データのパースに失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ 物語企画ブレスト失敗: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setIsBrainstorming(false);
    }
  };

  // 企画を選択してプロジェクトに一括反映
  const handleSelectConcept = (concept: MangaStoryConcept) => {
    const newCharacters: CastCharacter[] = concept.characters.map((c, idx) => {
      const charId = `char_${idx + 1}_${Date.now()}`;
      return createDefaultCastCharacter(
        charId,
        c.name,
        c.role,
        c.dnaPromptEn
      );
    });

    const updatedProject: MangaProject = {
      ...projectRef.current,
      title: concept.title,
      description: `【${concept.genre}】${concept.logline}`,
      storyConcept: concept,
      characters: newCharacters,
      activeCharacterId: newCharacters[0]?.id || 'char_1'
    };

    projectRef.current = updatedProject;
    onUpdateProject(updatedProject);
    setSelectedCharId(newCharacters[0]?.id || 'char_1');
    setBrainstormConcepts(null);
    onAddLog(`🎉 物語「${concept.title}」を採用し、主要キャスト3名を台帳に自動配役しました！`, 'success');
  };

  // 単一表情のAI自動生成 (Flow.generate.image を呼出)
  const handleGenerateExpression = async (expType: ExpressionType) => {
    const curProject = projectRef.current;
    const curCharId = selectedCharIdRef.current;
    const targetChar = curProject.characters.find(c => c.id === curCharId) || curProject.characters[0];
    if (!targetChar) return;

    const exp = targetChar.expressions[expType];
    const fullPrompt = `${targetChar.dnaPromptEn}, ${exp.promptModifierEn}, high aesthetic anime manga character bust-up portrait, vivid sharp clean line art, clean simple background, masterpiece, centered composition`;
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry';
    
    setGeneratingExp(expType);
    onAddLog(`🎨 ${targetChar.name} [${exp.label}] をAI生成中...`, 'process');

    try {
      const modelDef = resolveImageModel();
      const safeModelName = modelDef?.name || '🍌 Nano Banana 2';

      const res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: fullPrompt,
          negativePrompt: safeNegative,
          aspectRatio: '9:16',
          modelDisplayName: safeModelName,
        }),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ AI作画リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒後... (理由: ${formatErrorMessage(err)})`, 'warning');
        },
        3
      );

      const base64 = res?.base64 || res?.image?.base64;
      const mediaId = res?.mediaId || res?.image?.mediaId;

      if (base64) {
        updateExpression(expType, { 
          imageBase64: base64,
          mediaId: mediaId 
        });
        onAddLog(`✅ ${currentChar.name} [${exp.label}] の生成に成功しました！`, 'success');
      } else {
        throw new Error('画像データが返却されませんでした');
      }
    } catch (err: any) {
      onAddLog(`❌ 表情生成エラー: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setGeneratingExp(null);
    }
  };

  // 喜怒哀楽の一括自動生成
  const handleBulkGenerateExpressions = async () => {
    if (!currentChar) return;
    setIsBulkGenerating(true);
    onAddLog(`🚀 ${currentChar.name} の喜怒哀楽（6表情）を一括生成開始...`, 'process');

    const expTypes = Object.keys(EXPRESSION_METAS) as ExpressionType[];
    for (let i = 0; i < expTypes.length; i++) {
      const expType = expTypes[i];
      await handleGenerateExpression(expType);
      if (i < expTypes.length - 1) {
        // レートリミット対策として1.5秒待機
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsBulkGenerating(false);
    onAddLog(`🎉 ${currentChar.name} の全表情セットの生成が完了しました！`, 'success');
  };

  // プロジェクトJSONインポート
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await importProjectJson(file);
      onUpdateProject(loaded);
      if (loaded.characters[0]) {
        setSelectedCharId(loaded.characters[0].id);
      }
      onAddLog(`📂 プロジェクト「${loaded.title}」を完全復元しました！`, 'success');
    } catch (err: any) {
      onAddLog(`❌ インポート失敗: ${err.message}`, 'error');
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[860px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 material-symbols-outlined text-2xl">
              theater_comedy
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">キャスト台帳 ＆ マンガプロジェクト</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                  Cast Studio PRO
                </span>
              </div>
              <input 
                type="text"
                value={project.title}
                onChange={e => onUpdateProject({ ...project, title: e.target.value })}
                placeholder="プロジェクト名 (例: ネオ吉原 妖異始末記)"
                className="text-xs text-slate-500 font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-72 transition-colors mt-0.5"
              />
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* コミック一冊分 (30Cut×20話〜) 自動制作ボタン */}
            {onOpenComicWizard && (
              <button
                onClick={onOpenComicWizard}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="世界観・三面図・起承転結・サブキャラを順に決定し、30Cut×20話〜50話の連続漫画を一括自動プロデュース"
              >
                <span className="material-symbols-outlined text-sm">auto_stories</span>
                <span>📖 コミック一冊分 (30Cut×20話〜)</span>
              </button>
            )}

            {/* 物語企画AI発案 (10選) ボタン */}
            <button
              onClick={handleBrainstormConcepts}
              disabled={isBrainstorming}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all animate-pulse"
              title="現在の画風に合わせた10種類の物語企画と主要キャストをAIがブレスト提案"
            >
              <span className={`material-symbols-outlined text-sm ${isBrainstorming ? 'animate-spin' : ''}`}>
                {isBrainstorming ? 'autorenew' : 'casino'}
              </span>
              <span>{isBrainstorming ? '企画をAI発案中...' : '🎲 物語企画をAI発案 (10選)'}</span>
            </button>

            <input 
              type="file" 
              ref={projectFileInputRef} 
              accept=".json" 
              onChange={handleImportFile} 
              className="hidden" 
            />
            <button
              onClick={() => projectFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              title="以前保存したプロジェクトJSONを復元"
            >
              <span className="material-symbols-outlined text-sm text-indigo-500">file_upload</span>
              読込 (Load)
            </button>

            <button
              onClick={() => {
                exportProjectJson(project);
                onAddLog(`💾 プロジェクト「${project.title}」をダウンロードしました`, 'success');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
              title="キャスト設定と表情画像をすべてJSONにエクスポート"
            >
              <span className="material-symbols-outlined text-sm text-emerald-500">download</span>
              保存 (Export)
            </button>

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-2"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Character Tabs Selector */}
        <CastTabsBar
          characters={project.characters}
          selectedCharId={selectedCharId}
          onSelectCharId={setSelectedCharId}
          onAddCharacter={handleAddCharacter}
          onDeleteCharacter={handleDeleteCharacter}
        />

        {/* Main Body (Split into Left: Info & Right: Expression Matrix) */}
        {currentChar && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 dark-scrollbar">
            
            {/* Top: Character Profile & DNA & Turnaround */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shrink-0">
              
              {/* Left Column: Name, Role, Vault button (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-slate-500">badge</span>
                      キャラクター名
                    </label>
                    <input
                      type="text"
                      value={currentChar.name}
                      onChange={e => updateCurrentChar({ name: e.target.value })}
                      placeholder="例: 沖田総司 / 探偵 工藤"
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-slate-500">category</span>
                      物語上の役割
                    </label>
                    <select
                      value={currentChar.role}
                      onChange={e => updateCurrentChar({ role: e.target.value as any })}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-semibold"
                    >
                      <option value="protagonist">⚔️ 主人公 (Protagonist)</option>
                      <option value="partner">🤝 相棒・ヒロイン (Partner)</option>
                      <option value="antagonist">🔥 宿敵・ライバル (Antagonist)</option>
                      <option value="supporting">👥 サブキャラクター (Supporting)</option>
                    </select>
                  </div>
                </div>

                {/* DNA Prompt */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-indigo-500">fingerprint</span>
                      容姿・装飾 DNAプロンプト (Base Appearance DNA)
                    </label>
                    <span className="text-[10px] text-slate-400">※ 全カット共通の髪型・瞳・衣装</span>
                  </div>
                  <textarea
                    rows={2}
                    value={currentChar.dnaPromptEn}
                    onChange={e => updateCurrentChar({ dnaPromptEn: e.target.value })}
                    placeholder="A dashing young samurai with dark topknot, sharp jawline, wearing indigo haori with white dandaraya zig-zag pattern, holding katana"
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-700 resize-none leading-relaxed"
                  />
                </div>

                <button
                  onClick={() => {
                    onApplyCharacterToVault(currentChar, 'neutral');
                    onAddLog(`🎯 「${currentChar.name}」をメインキャラクター参照庫へ注入しました！`, 'success');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">lock_person</span>
                  このキャラをメイン参照庫へ注入 (Active DNA)
                </button>
              </div>

              {/* Right Column: Turnaround Sheet (16:9) (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-600">view_in_ar</span>
                    <span>三面図シート (16:9 正面・側面・背面)</span>
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    全身三面
                  </span>
                </div>

                {/* 16:9 Image Preview Box - height bounded to prevent button cutoff */}
                <div 
                  className="relative aspect-video w-full max-h-[185px] rounded-lg bg-slate-100 overflow-hidden border border-slate-200/80 group flex items-center justify-center shrink-0"
                >
                  {currentChar.turnaroundBase64 ? (
                    <>
                      <img 
                        src={toImageSrc(currentChar.turnaroundBase64)} 
                        alt="Turnaround" 
                        className="w-full h-full object-contain cursor-pointer bg-slate-900/10"
                        onClick={() => setZoomImage({
                          base64: currentChar.turnaroundBase64!,
                          title: `📐 ${currentChar.name} - キャラクター三面図 (正面・側面・背面)`,
                          prompt: currentChar.turnaroundPromptEn || currentChar.dnaPromptEn
                        })}
                      />
                      {/* Hover Zoom Overlay */}
                      <div 
                        onClick={() => setZoomImage({
                          base64: currentChar.turnaroundBase64!,
                          title: `📐 ${currentChar.name} - キャラクター三面図 (正面・側面・背面)`,
                          prompt: currentChar.turnaroundPromptEn || currentChar.dnaPromptEn
                        })}
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer gap-1.5 text-white"
                      >
                        <span className="material-symbols-outlined text-xl">zoom_in</span>
                        <span className="text-xs font-bold">クリックで拡大表示</span>
                      </div>

                      {/* Top Right Action Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateCurrentChar({ turnaroundBase64: undefined, turnaroundMediaId: undefined });
                        }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-slate-900/70 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="三面図を削除"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                    </>
                  ) : (
                    <div 
                      onClick={() => {
                        uploadTargetExpRef.current = 'turnaround';
                        fileInputRef.current?.click();
                      }}
                      className="flex flex-col items-center justify-center p-3 text-center gap-1 cursor-pointer hover:bg-slate-200/50 transition-colors w-full h-full"
                    >
                      <span className="material-symbols-outlined text-3xl text-slate-300">view_sidebar</span>
                      <span className="text-[11px] font-bold text-slate-600">三面図が未作成です</span>
                      <span className="text-[9px] text-slate-400">「三面図をAI作画」またはクリックして画像アップロード</span>
                    </div>
                  )}

                  {/* Generating Spinner Overlay */}
                  {isGeneratingTurnaround && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
                      <span className="material-symbols-outlined animate-spin text-2xl text-emerald-400">autorenew</span>
                      <span className="text-xs font-bold">三面図をAI作画中 (16:9)...</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons for Turnaround */}
                <div className="flex items-center gap-2 mt-0.5 shrink-0">
                  <button
                    onClick={handleGenerateTurnaround}
                    disabled={isGeneratingTurnaround}
                    className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">
                      {isGeneratingTurnaround ? 'progress_activity' : 'palette'}
                    </span>
                    <span>{isGeneratingTurnaround ? '作画中...' : '📐 三面図をAI作画 (16:9)'}</span>
                  </button>

                  <button
                    onClick={() => {
                      uploadTargetExpRef.current = 'turnaround';
                      fileInputRef.current?.click();
                    }}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="手動で三面図画像をアップロード"
                  >
                    <span className="material-symbols-outlined text-xs">upload</span>
                    <span>手動</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Scroll Indicator */}
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 py-0.5 select-none">
              <span className="material-symbols-outlined text-xs animate-bounce">expand_more</span>
              <span>下にスクロールして喜怒哀楽・表情マトリクス（全6表情）を確認</span>
            </div>

            {/* Bottom: 6 Expression Slots (喜怒哀楽マトリクス) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">face</span>
                  <h3 className="text-sm font-bold text-slate-800">喜怒哀楽・表情マトリクス (6スロット)</h3>
                  <span className="text-[11px] text-slate-400">※ 画像をクリックすると大画面で細部まで拡大確認できます</span>
                </div>
                <button
                  onClick={handleBulkGenerateExpressions}
                  disabled={isBulkGenerating || !!generatingExp}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isBulkGenerating ? 'progress_activity' : 'auto_mode'}
                  </span>
                  {isBulkGenerating ? '全表情を並列生成中...' : '🚀 喜怒哀楽を一括自動生成'}
                </button>
              </div>

              {/* 6 Grids */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {(Object.keys(EXPRESSION_METAS) as ExpressionType[]).map((expType) => {
                  const meta = EXPRESSION_METAS[expType];
                  const exp = currentChar.expressions[expType] || {
                    type: expType,
                    label: meta.label,
                    promptModifierEn: meta.promptModifierEn,
                  };
                  const isCurrentlyGenerating = generatingExp === expType;
                  const isWaitingInQueue = isBulkGenerating && !isCurrentlyGenerating && !exp.imageBase64;

                  return (
                    <div 
                      key={expType}
                      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-slate-300 transition-all group"
                    >
                      {/* Slot Header */}
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-slate-700">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-amber-500">{meta.icon}</span>
                          <span className="text-[11px] font-bold">{meta.label.split(' ')[0]}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* アップロードボタン */}
                          <button
                            onClick={() => {
                              uploadTargetExpRef.current = expType;
                              fileInputRef.current?.click();
                            }}
                            className="text-slate-400 hover:text-indigo-600"
                            title="画像を手動アップロード"
                          >
                            <span className="material-symbols-outlined text-xs">upload</span>
                          </button>
                          {exp.imageBase64 && (
                            <button
                              onClick={() => updateExpression(expType, { imageBase64: undefined })}
                              className="text-slate-400 hover:text-rose-500"
                              title="画像を削除"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Image Preview / Zoom Click Area */}
                      <div 
                        onClick={() => {
                          if (isCurrentlyGenerating || isBulkGenerating) return;
                          if (exp.imageBase64) {
                            // 画像がある場合は大画面ズームモーダル表示！
                            setZoomImage({
                              base64: exp.imageBase64,
                              title: `${currentChar.name} - [${meta.label}]`,
                              prompt: `${currentChar.dnaPromptEn}, ${exp.promptModifierEn}`
                            });
                          } else {
                            // 画像がない場合はアップロード選択
                            uploadTargetExpRef.current = expType;
                            fileInputRef.current?.click();
                          }
                        }}
                        className={`
                          relative aspect-square bg-slate-100 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-slate-400 hover:bg-slate-200/60 transition-colors group/img
                          ${isCurrentlyGenerating ? 'pointer-events-none' : ''}
                        `}
                      >
                        {exp.imageBase64 ? (
                          <>
                            <img 
                              src={toImageSrc(exp.imageBase64)} 
                              alt={meta.label} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                            />
                            {/* Hover Zoom Badge */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 backdrop-blur-2xs">
                              <span className="material-symbols-outlined text-2xl drop-shadow">zoom_in</span>
                              <span className="text-[10px] font-bold bg-slate-900/80 px-2 py-0.5 rounded-full">拡大確認</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center gap-1">
                            <span className="material-symbols-outlined text-2xl text-slate-300">add_photo_alternate</span>
                            <span className="text-[10px] text-slate-400 font-medium">クリック/貼付</span>
                          </div>
                        )}

                        {/* Generating Overlay: 今まさにこのスロットを作画中 */}
                        {isCurrentlyGenerating && (
                          <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white gap-1 backdrop-blur-xs">
                            <span className="material-symbols-outlined animate-spin text-xl text-amber-400">autorenew</span>
                            <span className="text-[9px] font-bold">作画中...</span>
                          </div>
                        )}

                        {/* Waiting in Queue Overlay: 一括生成中で順番待ち */}
                        {isWaitingInQueue && (
                          <div className="absolute inset-0 bg-slate-900/40 flex flex-col items-center justify-center text-white gap-1 backdrop-blur-xs">
                            <span className="material-symbols-outlined text-base text-slate-300">hourglass_top</span>
                            <span className="text-[9px] font-medium text-slate-200">待機中...</span>
                          </div>
                        )}
                      </div>

                      {/* Prompt Modifier & Action */}
                      <div className="p-2 flex flex-col gap-1.5 bg-slate-50/50">
                        <textarea
                          rows={2}
                          value={exp.promptModifierEn}
                          onChange={e => updateExpression(expType, { promptModifierEn: e.target.value })}
                          placeholder={meta.promptModifierEn}
                          className="w-full text-[10px] font-mono p-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-500 text-slate-600 resize-none leading-tight"
                        />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateExpression(expType);
                          }}
                          disabled={isCurrentlyGenerating || isBulkGenerating}
                          className="w-full py-1 bg-white hover:bg-amber-50 active:bg-amber-100 border border-slate-200 hover:border-amber-300 text-amber-700 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[12px] text-amber-500">
                            {isCurrentlyGenerating ? 'progress_activity' : 'magic_button'}
                          </span>
                          {isCurrentlyGenerating ? '作画中...' : 'AI作画'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* Hidden Global File Input for Slot Upload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*"
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && uploadTargetExpRef.current) {
              handleUploadImage(file, uploadTargetExpRef.current);
            }
            e.target.value = '';
          }}
        />

        {/* Bottom Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-sm text-slate-400">info</span>
            <span>登録された表情画像とDNAは、次回以降いつでも「保存 (Export)」したJSONから1秒で完全復元できます。</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              完了して閉じる
            </button>
          </div>
        </div>

      </div>

      {/* 1. 物語企画AI発案 (10選) 選択モーダル */}
      <CastBrainstormModal
        concepts={brainstormConcepts}
        currentTaste={currentTaste}
        onSelectConcept={handleSelectConcept}
        onClose={() => setBrainstormConcepts(null)}
      />

      {/* 2. 画像大画面拡大ズーム (Lightbox Modal) */}
      <CastImageZoomModal
        zoomImage={zoomImage}
        onClose={() => setZoomImage(null)}
      />

    </div>
  );
};
