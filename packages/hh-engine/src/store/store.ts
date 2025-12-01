// Engine's unified reducer - combines all internal reducers
// External applications should use this single reducer

import { combineReducers } from "@reduxjs/toolkit";

import sceneReducer from "./SceneSlice";
import layerReducer from "./LayerSlice";
import gameObjectReducer from "./GameObjectSlice";
import componentReducer from "./ComponentSlice";

// Export the combined reducer for external use
export const engineReducer = combineReducers({
  scenes: sceneReducer,
  layers: layerReducer,
  gameObjects: gameObjectReducer,
  components: componentReducer,
});

export type EngineState = ReturnType<typeof engineReducer>;
