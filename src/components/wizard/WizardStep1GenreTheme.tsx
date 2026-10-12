import React from 'react';
import { ProductionMode } from '../../types';
import { TurnaroundCandidate } from '../../services/comicWizardService';
import { WizardProductionModeCardGrid } from './WizardProductionModeCardGrid';
import { WizardThemeSelector } from './WizardThemeSelector';
import { WizardTasteSelector } from './WizardTasteSelector';
import { WizardCandidateGrid } from './WizardCandidateGrid';

interface WizardStep1GenreThemeProps {
  productionMode: ProductionMode;
  currentModeConfig: { label: string; [key: string]: any };
  onModeChange: (newMode: ProductionMode) => void;
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
  selectedThemeCategory: string;
  onThemeCategoryChange: (cat: string) => void;
  onRandomTheme: () => void;
  tasteMode: 'ai_auto' | 'custom_pick';
  onTasteModeChange: (mode: 'ai_auto' | 'custom_pick') => void;
  selectedCustomTastes: string[];
  onToggleTaste: (key: string) => void;
  onClearCustomTastes: () => void;
  tasteSearchQuery: string;
  onTasteSearchQueryChange: (q: string) => void;
  filteredTasteKeys: string[];
  onGenerateCandidates: () => void;
  isBrainstormingCandidates: boolean;
  activeGeneratingIndex: number | null;
  candidates: TurnaroundCandidate[];
  selectedCandidateId: string | null;
  currentCandidate: TurnaroundCandidate | null;
  onSelectCandidate: (id: string) => void;
  onProceedToStep2: (cand: TurnaroundCandidate) => void;
  onZoomImage: (img: { base64: string; title: string }) => void;
}

export const WizardStep1GenreTheme: React.FC<WizardStep1GenreThemeProps> = ({
  productionMode,
  currentModeConfig,
  onModeChange,
  selectedTheme,
  onThemeChange,
  selectedThemeCategory,
  onThemeCategoryChange,
  onRandomTheme,
  tasteMode,
  onTasteModeChange,
  selectedCustomTastes,
  onToggleTaste,
  onClearCustomTastes,
  tasteSearchQuery,
  onTasteSearchQueryChange,
  filteredTasteKeys,
  onGenerateCandidates,
  isBrainstormingCandidates,
  activeGeneratingIndex,
  candidates,
  selectedCandidateId,
  currentCandidate,
  onSelectCandidate,
  onProceedToStep2,
  onZoomImage,
}) => {
  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* 1. Production Mode Selector (大枠選択) */}
      <WizardProductionModeCardGrid
        productionMode={productionMode}
        currentModeConfig={currentModeConfig}
        onModeChange={onModeChange}
      />

      {/* Guidance Box */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 p-3.5 rounded-xl flex items-start gap-3 text-indigo-950 shadow-2xs">
        <span className="material-symbols-outlined text-indigo-600 mt-0.5 text-xl">auto_fix_high</span>
        <div className="text-xs leading-relaxed">
          <p className="font-bold">制作大枠と世界観を選び、「三面図を一括AI作画」ボタンを押してください。</p>
          <p className="text-indigo-700 mt-0.5">
            基本は<strong>「AIおまかせ」</strong>で大枠に最適な5画風×三面図を自動作画しますが、<strong>「自分で画風を指定」</strong>で好きな画風を1〜5個ピンポイント指定することも可能です！
            上部の<strong>「JSON保存」「JSON読込」</strong>で、設定内容をいつでもローカルにバックアップ・復元できます。
          </p>
        </div>
      </div>

      {/* 2. Theme Selector Section */}
      <WizardThemeSelector
        currentModeConfig={currentModeConfig}
        selectedTheme={selectedTheme}
        onThemeChange={onThemeChange}
        selectedThemeCategory={selectedThemeCategory}
        onThemeCategoryChange={onThemeCategoryChange}
        onRandomTheme={onRandomTheme}
      />

      {/* 3. Taste Selection Mode & Action Button */}
      <WizardTasteSelector
        tasteMode={tasteMode}
        onTasteModeChange={onTasteModeChange}
        selectedCustomTastes={selectedCustomTastes}
        onToggleTaste={onToggleTaste}
        onClearCustomTastes={onClearCustomTastes}
        tasteSearchQuery={tasteSearchQuery}
        onTasteSearchQueryChange={onTasteSearchQueryChange}
        filteredTasteKeys={filteredTasteKeys}
        onGenerateCandidates={onGenerateCandidates}
        isBrainstormingCandidates={isBrainstormingCandidates}
        activeGeneratingIndex={activeGeneratingIndex}
      />

      {/* 4. Candidates 5 Cards Grid */}
      <WizardCandidateGrid
        candidates={candidates}
        selectedCandidateId={selectedCandidateId}
        currentCandidate={currentCandidate}
        onSelectCandidate={onSelectCandidate}
        onProceedToStep2={onProceedToStep2}
        onZoomImage={onZoomImage}
      />
    </div>
  );
};
