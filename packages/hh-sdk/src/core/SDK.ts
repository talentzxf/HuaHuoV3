import paper from 'paper';
import { Engine } from '@huahuo/engine';
import { SceneAPI } from '../scene/SceneAPI';
import { EditorAPI } from '../editor/EditorAPI';

export class SDK {
  private static _instance: SDK | null = null;

  public readonly Scene: SceneAPI;
  public readonly Editor: EditorAPI;

  private constructor(engine: Engine, editorAPI: EditorAPI) {
    this.Scene = new SceneAPI(engine);
    this.Editor = editorAPI;
  }

  /**
   * Initialize the SDK
   * @param scope - Paper.js scope
   */
  static initialize(scope: paper.PaperScope): void {
    if (!SDK._instance) {
      const engine = new Engine(scope);
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
   * Reset the SDK (for testing)
   */
  static reset(): void {
    SDK._instance = null;
  }
}

