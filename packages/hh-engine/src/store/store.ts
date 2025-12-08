// Engine's unified reducer - combines all internal reducers
// External applications should use this single reducer

import { combineReducers } from "@reduxjs/toolkit";

import projectReducer from "./ProjectSlice";
import sceneReducer from "./SceneSlice";
import layerReducer from "./LayerSlice";
import gameObjectReducer from "./GameObjectSlice";
import componentReducer from "./ComponentSlice";
import playbackReducer from "./PlaybackSlice";

// Export the combined reducer for external use
export const engineReducer = combineReducers({
  project: projectReducer,
  scenes: sceneReducer,
  layers: layerReducer,
  gameObjects: gameObjectReducer,
  components: componentReducer,
  playback: playbackReducer,
});

export type EngineState = ReturnType<typeof engineReducer>;
