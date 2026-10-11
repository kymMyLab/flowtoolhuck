import React, { useState, useRef } from 'react';
import { MangaProject, CastCharacter, ExpressionType, CastExpression } from '../types';
import { EXPRESSION_METAS, createDefaultCastCharacter, exportProjectJson, importProjectJson } from '../services/castStorage';
import { PrimaryButton, SecondaryButton, SectionLabel } from './Primitives';
import { Flow } from 'flow-sdk';
import { resolveImageModel } from '../constants';
import { callWithRetry, formatErrorMessage } from '../services/utils';

interface CastManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: MangaProject;
  onUpdateProject: (updated: MangaProject) => void;
  onApplyCharacterToVault: (character: CastCharacter, expressionType?: ExpressionType) => void;
  onAddLog: (msg: string, type?: any) => void;
}

export const CastManagerModal: React.FC<CastManagerModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateProject,
  onApplyCharacterToVault,
  onAddLog,
}) => {
  const [selectedCharId, setSelectedCharId] = useState<string>(
    project.activeCharacterId || project.characters[0]?.id || 'char_1'
  );
  const [generatingExp, setGeneratingExp] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetExpRef = useRef<ExpressionType | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentChar = project.characters.find(c => c.id === selectedCharId) || project.characters[0];

  // キャラクターの更新
  const updateCurrentChar = (patch: Partial<CastCharacter>) => {
    if (!currentChar) return;
    const updatedChars = project.characters.map(c => 
      c.id === currentChar.id ? { ...c, ...patch } : c
    );
    onUpdateProject({ ...project, characters: updatedChars });
  };

  // 表情プロンプト・画像の更新
  const updateExpression = (expType: ExpressionType, patch: Partial<CastExpression>) => {
    if (!currentChar) return;
    const updatedExpressions = {
      ...currentChar.expressions,
      [expType]: { ...currentChar.expressions[expType], ...patch }
    };
    // 通常(neutral)の画像が更新された場合、アバター画像も自動更新
    const avatarBase64 = expType === 'neutral' && patch.imageBase64 !== undefined 
      ? patch.imageBase64 
      : currentChar.avatarBase64;

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
  const handleUploadImage = (file: File, expType: ExpressionType) => {
    if (!file.type.startsWith('image/')) {
      onAddLog('❌ 画像ファイルを選択してください', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64WithPrefix = e.target?.result as string;
      const base64 = base64WithPrefix.split(',')[1];
      updateExpression(expType, { imageBase64: base64 });
      onAddLog(`✨ 「${EXPRESSION_METAS[expType].label}」スロットに画像を登録しました`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // 単一表情のAI自動生成 (Flow.generate.image を呼出)
  const handleGenerateExpression = async (expType: ExpressionType) => {
    if (!currentChar) return;
    const exp = currentChar.expressions[expType];
    const fullPrompt = `${currentChar.dnaPromptEn}, ${exp.promptModifierEn}, high aesthetic anime manga character bust-up portrait, vivid sharp clean line art, clean simple background, masterpiece, centered composition`;
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry';
    
    setGeneratingExp(expType);
    onAddLog(`🎨 ${currentChar.name} [${exp.label}] をAI生成中...`, 'process');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
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
        <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {project.characters.map((char, index) => {
              const isSelected = char.id === selectedCharId;
              const roleBadgeColor = 
                char.role === 'protagonist' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                char.role === 'partner' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
                char.role === 'antagonist' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                'bg-slate-100 text-slate-700 border-slate-300';
              
              const roleLabels: Record<string, string> = {
                protagonist: '主人公',
                partner: '相棒',
                antagonist: '宿敵',
                supporting: 'サブ'
              };

              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className={`
                    flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap
                    ${isSelected 
                      ? 'bg-white border-amber-500 text-slate-900 shadow-sm ring-2 ring-amber-500/20' 
                      : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                    }
                  `}
                >
                  {/* Mini Avatar */}
                  <div className="w-6 h-6 rounded-lg bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center border border-slate-300/50">
                    {char.avatarBase64 ? (
                      <img src={`data:image/png;base64,${char.avatarBase64}`} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                    )}
                  </div>
                  <span>{char.name || `キャラ ${index + 1}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleBadgeColor}`}>
                    {roleLabels[char.role]}
                  </span>
                </button>
              );
            })}

            {project.characters.length < 8 && (
              <button
                onClick={handleAddCharacter}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-400 hover:bg-white transition-all shrink-0 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                キャラ追加
              </button>
            )}
          </div>

          {/* Delete Current Character Button */}
          {currentChar && project.characters.length > 1 && (
            <button
              onClick={() => handleDeleteCharacter(currentChar.id)}
              className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 shrink-0 whitespace-nowrap"
              title="選択中のキャラクターを削除"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              <span>削除</span>
            </button>
          )}
        </div>

        {/* Main Body (Split into Left: Info & Right: Expression Matrix) */}
        {currentChar && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            
            {/* Top: Character Profile & DNA */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-slate-500">badge</span>
                  キャラクター名
                </label>
                <input
                  type="text"
                  value={currentChar.name}
                  onChange={e => updateCurrentChar({ name: e.target.value })}
                  placeholder="例: 沖田総司 / 密偵 千代"
                  className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
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

              <div className="flex flex-col justify-end">
                <button
                  onClick={() => {
                    onApplyCharacterToVault(currentChar, 'neutral');
                    onAddLog(`🎯 「${currentChar.name}」をメインキャラクター参照庫へ注入しました！`, 'success');
                  }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">lock_person</span>
                  参照庫に適用 (Active DNA)
                </button>
              </div>

              {/* DNA Prompt Full Width */}
              <div className="md:col-span-3 flex flex-col gap-1.5 mt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-indigo-500">fingerprint</span>
                    容姿・装飾 DNAプロンプト (Base Appearance DNA)
                  </label>
                  <span className="text-[10px] text-slate-400">※ 全カットの基準となる髪型・瞳・体型・衣装</span>
                </div>
                <textarea
                  rows={2}
                  value={currentChar.dnaPromptEn}
                  onChange={e => updateCurrentChar({ dnaPromptEn: e.target.value })}
                  placeholder="A dashing young samurai with dark topknot, sharp jawline, wearing indigo haori with white dandaraya zig-zag pattern, holding katana"
                  className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-slate-700 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Bottom: 6 Expression Slots (喜怒哀楽マトリクス) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500">face</span>
                  <h3 className="text-sm font-bold text-slate-800">喜怒哀楽・表情マトリクス (6スロット)</h3>
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
                  const isGenerating = generatingExp === expType || isBulkGenerating;

                  return (
                    <div 
                      key={expType}
                      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-all group"
                    >
                      {/* Slot Header */}
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-slate-700">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-amber-500">{meta.icon}</span>
                          <span className="text-[11px] font-bold">{meta.label.split(' ')[0]}</span>
                        </div>
                        {exp.imageBase64 && (
                          <button
                            onClick={() => updateExpression(expType, { imageBase64: undefined })}
                            className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="画像を削除"
                          >
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        )}
                      </div>

                      {/* Image Preview / Upload Drop Area */}
                      <div 
                        onClick={() => {
                          uploadTargetExpRef.current = expType;
                          fileInputRef.current?.click();
                        }}
                        className={`
                          relative aspect-square bg-slate-100 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-slate-400 hover:bg-slate-200/60 transition-colors
                          ${isGenerating ? 'pointer-events-none' : ''}
                        `}
                      >
                        {exp.imageBase64 ? (
                          <img 
                            src={`data:image/png;base64,${exp.imageBase64}`} 
                            alt={meta.label} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center gap-1">
                            <span className="material-symbols-outlined text-2xl text-slate-300">add_photo_alternate</span>
                            <span className="text-[10px] text-slate-400 font-medium">クリック/貼付</span>
                          </div>
                        )}

                        {/* Generating Overlay */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white gap-1 backdrop-blur-xs">
                            <span className="material-symbols-outlined animate-spin text-xl text-amber-400">autorenew</span>
                            <span className="text-[9px] font-bold">作画中...</span>
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
                          disabled={isGenerating}
                          className="w-full py-1 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-700 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[12px]">magic_button</span>
                          AI作画
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
    </div>
  );
};
