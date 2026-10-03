import React, { useState, useRef, useEffect } from 'react';
import { ReferenceAsset } from '../types';
import { SectionLabel } from './Primitives';
import { saveReferenceAsset, deleteReferenceAsset } from '../services/db';

interface ReferenceVaultProps {
  assets: ReferenceAsset[];
  selectedId?: number;
  onSelect: (id?: number) => void;
  onRefresh: () => void;
  onAddLog: (msg: string, type?: any) => void;
  disabled?: boolean;
}

export const ReferenceVault: React.FC<ReferenceVaultProps> = ({ 
  assets, selectedId, onSelect, onRefresh, onAddLog, disabled 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onAddLog('❌ 画像ファイルを選択してください', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64WithPrefix = e.target?.result as string;
      const base64 = base64WithPrefix.split(',')[1];
      
      const newAsset: ReferenceAsset = {
        name: file.name,
        base64: base64,
        mimeType: file.type,
        createdAt: new Date().toISOString()
      };

      try {
        const id = await saveReferenceAsset(newAsset);
        onRefresh();
        onSelect(id);
        onAddLog(`✨ Vaultに画像「${file.name}」を保管しました`, 'success');
      } catch (err) {
        onAddLog('❌ 画像の保存に失敗しました', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const pastedFile = new File([file], `Pasted_${Date.now()}.png`, { type: file.type });
            handleFile(pastedFile);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (disabled) return;
    await deleteReferenceAsset(id);
    if (selectedId === id) onSelect(undefined);
    onRefresh();
    onAddLog('🗑️ 画像を削除しました', 'info');
  };

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>キャラクター参照庫 (Reference Vault)</SectionLabel>
      
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-h-[64px]">
        {/* Upload Slot (Small square) */}
        <div 
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`
            shrink-0 w-14 h-14 border border-dashed rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
            ${isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}
            ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
          `}
        >
          <span className="material-symbols-outlined text-[16px] text-white/40">add</span>
          <span className="text-[6px] font-black text-white/30 uppercase tracking-tighter text-center leading-none">UP / PASTE</span>
          <input 
            type="file" ref={fileInputRef} className="hidden" accept="image/*" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
          />
        </div>

        {/* Thumbnail Row - Combined in same horizontal line */}
        {assets.map(asset => (
          <div 
            key={asset.id}
            onClick={() => !disabled && onSelect(selectedId === asset.id ? undefined : asset.id)}
            className={`
              relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer group
              ${selectedId === asset.id ? 'border-amber-500 shadow-md scale-105' : 'border-white/5 opacity-60 hover:opacity-100'}
              ${disabled ? 'pointer-events-none' : ''}
            `}
          >
            <img src={`data:${asset.mimeType};base64,${asset.base64}`} className="w-full h-full object-cover" />
            {selectedId === asset.id && (
              <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[12px] font-black">check_circle</span>
              </div>
            )}
            <button 
              onClick={(e) => handleDelete(e, asset.id!)}
              className="absolute top-0 right-0 p-0.5 bg-black/60 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-[10px]">close</span>
            </button>
          </div>
        ))}

        {assets.length === 0 && !isDragging && (
          <div className="flex items-center px-2 h-14 opacity-10">
             <span className="text-[8px] font-bold uppercase tracking-widest italic">Vault Empty</span>
          </div>
        )}
      </div>
    </div>
  );
};