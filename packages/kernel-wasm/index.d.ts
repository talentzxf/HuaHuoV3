export interface KernelCommandResult {
  ok: boolean;
  error: string;
  created_id: string;
  payload?: Uint8Array;
}

export interface KernelQueryResult {
  ok: boolean;
  error: string;
  data: any;
}

export declare class KernelAPI {
  dispatch_json(cmdJson: string): string;
  query_json(queryJson: string): string;
  subscribe_js(pattern: string, callback: (evJson: string) => void): number;
  unsubscribe_js(subId: number): void;
  take_pending_events_json(): string;
  save_project_bytes(): Uint8Array;
  load_project_bytes(data: Uint8Array): boolean;
}

declare function init(): Promise<void>;
export default init;

