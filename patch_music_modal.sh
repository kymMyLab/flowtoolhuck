#!/bin/bash
cat << 'PATCH_EOF' > modify_music_modal.diff
<<<<<<< SEARCH
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode } from '../../types';

interface MusicImportModalProps {
=======
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode, CastCharacter } from '../../types';
import { loadMangaProject } from '../../services/castStorage';

interface MusicImportModalProps {
>>>>>>> REPLACE
<<<<<<< SEARCH
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleParse = useCallback((text: string) => {
=======
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const [characters, setCharacters] = useState<CastCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  useEffect(() => {
    const project = loadMangaProject();
    if (project.characters && project.characters.length > 0) {
      setCharacters(project.characters);
      const protag = project.characters.find(c => c.role === 'protagonist');
      if (protag) {
        setSelectedCharacterId(protag.id);
      } else {
        setSelectedCharacterId(project.characters[0].id);
      }
    }
  }, []);

  const handleParse = useCallback((text: string) => {
>>>>>>> REPLACE
<<<<<<< SEARCH
  const handleDeploySingle = (track: ImportedTrack) => {
    try {
      const episode = convertTrackToEpisode(track, videoRatio);
      onDeployEpisode(episode);
      onClose();
    } catch (err: any) {
=======
  const handleDeploySingle = (track: ImportedTrack) => {
    try {
      const selectedCharacter = characters.find(c => c.id === selectedCharacterId) || undefined;
      const episode = convertTrackToEpisode(track, videoRatio, selectedCharacter);
      onDeployEpisode(episode);
      onClose();
    } catch (err: any) {
>>>>>>> REPLACE
<<<<<<< SEARCH
  const handleDeployAll = () => {
    if (parsedTracks.length === 0) return;
    try {
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t, videoRatio));
=======
  const handleDeployAll = () => {
    if (parsedTracks.length === 0) return;
    try {
      const selectedCharacter = characters.find(c => c.id === selectedCharacterId) || undefined;
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t, videoRatio, selectedCharacter));
>>>>>>> REPLACE
<<<<<<< SEARCH
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-purple-950/30">
          <div className="flex items-center gap-3">
=======
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-purple-950/30">
          <div className="flex items-center gap-3">
>>>>>>> REPLACE
PATCH_EOF
patch src/components/music/MusicImportModal.tsx modify_music_modal.diff
