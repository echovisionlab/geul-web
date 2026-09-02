'use client';

import { useEffect, useRef } from 'react';
import { isKratosWebAuthnRuntimeReady, type KratosCredentialOperation, type KratosUiNode } from './kratos-flow';

interface KratosWebAuthnScriptProps {
  nodes: KratosUiNode[];
  onError?: () => void;
  onReady?: () => void;
  readyKey?: string;
  credentialOperation: KratosCredentialOperation;
  requiredTriggers: readonly unknown[];
}

export function KratosWebAuthnScript({
  nodes,
  onError,
  onReady,
  readyKey = 'default',
  credentialOperation,
  requiredTriggers,
}: KratosWebAuthnScriptProps) {
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const firedReadyKeyRef = useRef<string | null>(null);
  const firedErrorKeyRef = useRef<string | null>(null);
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  const scriptNode = nodes.find((node) => node.type === 'script' && typeof node.attributes.src === 'string');
  const src = scriptNode?.attributes.src;
  const id = scriptNode?.attributes.id || 'webauthn_script';
  const integrity = scriptNode?.attributes.integrity;
  const crossOrigin = scriptNode?.attributes.crossorigin;
  const referrerPolicy = scriptNode?.attributes.referrerpolicy;
  const async = scriptNode?.attributes.async;
  const requiredTriggersKey = requiredTriggers
    .map((trigger) => (typeof trigger === 'string' ? trigger : ''))
    .join('\u0000');

  useEffect(() => {
    const handleReady = () => {
      if (firedReadyKeyRef.current === readyKey) {
        return;
      }
      firedReadyKeyRef.current = readyKey;
      onReadyRef.current?.();
    };
    const handleError = () => {
      if (firedErrorKeyRef.current === readyKey) {
        return;
      }
      firedErrorKeyRef.current = readyKey;
      onErrorRef.current?.();
    };
    const requiredTriggerNames = requiredTriggersKey.split('\u0000');
    const reportRuntimeState = () => {
      if (isKratosWebAuthnRuntimeReady(credentialOperation, requiredTriggerNames)) {
        handleReady();
      } else {
        handleError();
      }
    };

    if (
      !window.PublicKeyCredential ||
      !window.navigator.credentials ||
      typeof window.navigator.credentials[credentialOperation] !== 'function'
    ) {
      handleError();
      return;
    }

    if (isKratosWebAuthnRuntimeReady(credentialOperation, requiredTriggerNames)) {
      handleReady();
      return;
    }

    if (!src) {
      handleError();
      return;
    }

    let script = document.getElementById(id) as HTMLScriptElement | null;

    if (script?.dataset.oryWebauthnLoaded === 'true') {
      reportRuntimeState();
      return;
    }
    if (script?.dataset.oryWebauthnError === 'true') {
      handleError();
      return;
    }

    window.addEventListener('oryWebAuthnInitialized', reportRuntimeState);

    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = async !== false;
      if (integrity) {
        script.integrity = integrity;
      }
      if (crossOrigin) {
        script.crossOrigin = crossOrigin;
      }
      if (referrerPolicy) {
        script.referrerPolicy = referrerPolicy as HTMLScriptElement['referrerPolicy'];
      }
      document.head.appendChild(script);
    }

    const handleScriptReady = () => {
      if (script) {
        script.dataset.oryWebauthnLoaded = 'true';
        delete script.dataset.oryWebauthnError;
      }
      reportRuntimeState();
    };
    const handleScriptError = () => {
      if (script) {
        script.dataset.oryWebauthnError = 'true';
      }
      handleError();
    };

    script.addEventListener('load', handleScriptReady);
    script.addEventListener('error', handleScriptError);
    if (isKratosWebAuthnRuntimeReady(credentialOperation, requiredTriggerNames)) {
      handleReady();
    }

    return () => {
      window.removeEventListener('oryWebAuthnInitialized', reportRuntimeState);
      script?.removeEventListener('load', handleScriptReady);
      script?.removeEventListener('error', handleScriptError);
    };
  }, [async, credentialOperation, crossOrigin, id, integrity, readyKey, referrerPolicy, requiredTriggersKey, src]);

  return null;
}
