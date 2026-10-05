import { createClient } from '@connectrpc/connect';
import { AIService, AIDocumentService } from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { createBrowserTransport } from './secure-transport';

export function createAIClient() {
  return createClient(AIService, createBrowserTransport());
}

export function createAIDocumentClient() {
  return createClient(AIDocumentService, createBrowserTransport());
}
