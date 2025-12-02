import { Engine } from '@huahuo/engine';
import { SceneAPI } from '../scene/SceneAPI';
import { EditorAPI } from '../editor/EditorAPI';

export class SDK {
  private static _instance: SDK | null = null;

  public readonly Scene: SceneAPI;
  public readonly Editor: EditorAPI;
  private engine: Engine;

  private constructor(engine: Engine, editorAPI: EditorAPI) {
    this.engine = engine;
    this.Scene = new SceneAPI(engine);
    this.Editor = editorAPI;
  }

  /**
   * Initialize the SDK
   * @param canvas - HTML Canvas element
   * @param store - Redux store instance
   * @param selectEngineState - Selector function to get engine state from store
   */
  static initialize(canvas: HTMLCanvasElement, store: any, selectEngineState: (state: any) => any): void {
    if (!SDK._instance) {
      const engine = new Engine(canvas, store, selectEngineState);
      const editorAPI = new EditorAPI();
      SDK._instance = new SDK(engine, editorAPI);
    }
  }

  /**
   * Get the SDK instance
   */
  static get instance(): SDK {
    if (!SDK._instance) {
      throw new Error('SDK not initialized. Call SDK.initialize(scope) first.');
    }
    return SDK._instance;
  }

  /**
   * Check if SDK is initialized
   */
  static isInitialized(): boolean {
    return SDK._instance !== null;
  }

  /**
   * Select a GameObject (updates render item selection state)
   * Call this from IDE when selection changes
   */
  selectGameObject(gameObjectId: string | null): void {
    this.engine.selectGameObject(gameObjectId);
  }

  /**
   * Get currently selected GameObject ID
   */
  getSelectedGameObjectId(): string | null {
    return this.engine.getSelectedGameObjectId();
  }

  /**
   * Reset the SDK (for testing)
   */
  static reset(): void {
    SDK._instance = null;
  }
}

