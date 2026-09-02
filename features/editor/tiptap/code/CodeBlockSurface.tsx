'use client';

import { IconChevronDown, IconCopy } from '@tabler/icons-react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { MonacoSourceEditor, type SourceEditorChange } from '../code-editor';
import { PrintCodeSource } from './PrintCodeSource';
import classes from './CodeBlockSurface.module.css';

export function codeBlockEditorHeight(source: string): number {
  return Math.max(180, Math.min(520, 56 + source.split('\n').length * 20));
}

export interface CodeBlockSurfaceProps {
  title: string;
  fallbackTitle: string;
  titleLabel: string;
  languageName: string;
  languageLabel?: string;
  languageValue?: string;
  languageOptions?: readonly { label: string; value: string }[];
  source: string;
  sourceLabel: string;
  copyLabel: string;
  monacoLanguage: string;
  modelPath: string;
  titleEditable?: boolean;
  sourceReadOnly?: boolean;
  onTitleChange?: (title: string) => void;
  onLanguageChange?: (language: string) => void;
  onSourceChange?: (source: string, change: SourceEditorChange) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onEscape?: () => void;
  onMount?: (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => void | (() => void);
}

export function CodeBlockSurface({
  title,
  fallbackTitle,
  titleLabel,
  languageName,
  languageLabel,
  languageValue,
  languageOptions,
  source,
  sourceLabel,
  copyLabel,
  monacoLanguage,
  modelPath,
  titleEditable = false,
  sourceReadOnly = true,
  onTitleChange,
  onLanguageChange,
  onSourceChange,
  onUndo,
  onRedo,
  onEscape,
  onMount,
}: CodeBlockSurfaceProps) {
  const visibleTitle = title.trim() || fallbackTitle;

  return (
    <div className={classes.root} data-code-block-surface="">
      <div className={classes.header} data-code-block-control="">
        <span className={classes.printTitle}>{visibleTitle}</span>
        {titleEditable ? (
          <input
            className={classes.titleInput}
            aria-label={titleLabel}
            value={title}
            placeholder={fallbackTitle}
            onChange={(event) => onTitleChange?.(event.currentTarget.value)}
          />
        ) : (
          <span className={classes.title}>{visibleTitle}</span>
        )}
        <div className={classes.meta}>
          {languageLabel && languageValue && languageOptions && onLanguageChange ? (
            <DropdownMenu size="compact" placement="bottom-end">
              <DropdownMenu.Target>
                <Button
                  type="button"
                  className={classes.languageButton}
                  size="compact-xs"
                  tone="neutral"
                  emphasis="low"
                  rightSection={<IconChevronDown size={12} aria-hidden />}
                  aria-label={`${languageLabel}: ${languageName}`}
                  data-testid="code-block-language"
                >
                  {languageName}
                </Button>
              </DropdownMenu.Target>
              <DropdownMenu.Dropdown>
                {languageOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.value}
                    selected={option.value === languageValue}
                    onClick={() => onLanguageChange(option.value)}
                  >
                    {option.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Dropdown>
            </DropdownMenu>
          ) : (
            <span className={classes.language}>{languageName}</span>
          )}
          <span className={classes.copyAction}>
            <Tooltip label={copyLabel} withArrow>
              <IconButton
                label={copyLabel}
                title={copyLabel}
                size="sm"
                tone="neutral"
                emphasis="low"
                onClick={() => void navigator.clipboard.writeText(source)}
              >
                <IconCopy size={16} aria-hidden />
              </IconButton>
            </Tooltip>
          </span>
        </div>
      </div>
      <div className={classes.editor}>
        <MonacoSourceEditor
          value={source}
          onChange={sourceReadOnly ? undefined : onSourceChange}
          onUndo={sourceReadOnly ? undefined : onUndo}
          onRedo={sourceReadOnly ? undefined : onRedo}
          onEscape={onEscape}
          language={monacoLanguage}
          readOnly={sourceReadOnly}
          ariaLabel={`${visibleTitle} — ${sourceLabel}`}
          modelPath={modelPath}
          height={codeBlockEditorHeight(source)}
          bordered={false}
          editorOptions={{
            lineDecorationsWidth: 16,
            renderValidationDecorations: sourceReadOnly ? 'off' : 'on',
          }}
          onMount={onMount}
        />
      </div>
      <div className={classes.printSource} data-code-block-print-source="">
        <PrintCodeSource language={languageValue || monacoLanguage} source={source} />
      </div>
    </div>
  );
}
