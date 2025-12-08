import { createSlice, PayloadAction, nanoid } from "@reduxjs/toolkit";

// KeyFrame data for a single property
export interface PropertyKeyFrame {
    frame: number;
    value: any;
}

export interface ComponentSlice {
    id: string;
    type: string;                        // Component type name
    parentId: string;                    // GameObject ID
    enabled: boolean;
    props: Record<string, any>;          // Current animated values (interpolated)
    keyFrames: Record<string, PropertyKeyFrame[]>; // Property name -> sorted keyframes
}

export interface ComponentState {
    byId: Record<string, ComponentSlice>;
}

const initialState: ComponentState = {
    byId: {}
};

const componentSlice = createSlice({
    name: "components",
    initialState,
    reducers: {
        createComponent: {
            reducer(
                state,
                action: PayloadAction<{
                    id: string;
                    type: string;
                    parentId: string;
                    initialProps: Record<string, any>;
                }>
            ) {
                const { id, type, parentId, initialProps } = action.payload;

                state.byId[id] = {
                    id,
                    type,
                    parentId,
                    enabled: true,
                    props: { ...initialProps },
                    keyFrames: {}  // Initialize empty keyframes
                };
            },
            prepare(type: string, parentId: string, initialProps: Record<string, any>) {
                return {
                    payload: {
                        id: nanoid(),
                        type,
                        parentId,
                        initialProps
                    }
                };
            }
        },

        deleteComponent(state, action: PayloadAction<string>) {
            delete state.byId[action.payload];
        },

        setComponentEnabled(
            state,
            action: PayloadAction<{ id: string; enabled: boolean }>
        ) {
            const { id, enabled } = action.payload;
            if (state.byId[id]) {
                state.byId[id].enabled = enabled;
            }
        },

        updateComponentProps(
            state,
            action: PayloadAction<{ id: string; patch: Record<string, any> }>
        ) {
            const { id, patch } = action.payload;
            if (state.byId[id]) {
                Object.assign(state.byId[id].props, patch);
            }
        },

        reparentComponent(
            state,
            action: PayloadAction<{ id: string; parentId: string }>
        ) {
            const { id, parentId } = action.payload;
            if (state.byId[id]) {
                state.byId[id].parentId = parentId;
            }
        },

        /**
         * Set a keyframe for a specific property at a specific frame
         */
        setPropertyKeyFrame(
            state,
            action: PayloadAction<{
                componentId: string;
                propName: string;
                frame: number;
                value: any
            }>
        ) {
            const { componentId, propName, frame, value } = action.payload;
            const component = state.byId[componentId];
            if (!component) return;

            // Initialize keyframes array for this property if it doesn't exist
            if (!component.keyFrames[propName]) {
                component.keyFrames[propName] = [];
            }

            const keyFrames = component.keyFrames[propName];

            // Find existing keyframe at this frame
            const existingIndex = keyFrames.findIndex(kf => kf.frame === frame);

            if (existingIndex !== -1) {
                // Update existing keyframe
                keyFrames[existingIndex].value = value;
            } else {
                // Add new keyframe and keep sorted by frame
                keyFrames.push({ frame, value });
                keyFrames.sort((a, b) => a.frame - b.frame);
            }
        },

        /**
         * Remove a keyframe for a specific property at a specific frame
         */
        removePropertyKeyFrame(
            state,
            action: PayloadAction<{
                componentId: string;
                propName: string;
                frame: number;
            }>
        ) {
            const { componentId, propName, frame } = action.payload;
            const component = state.byId[componentId];
            if (!component || !component.keyFrames[propName]) return;

            component.keyFrames[propName] = component.keyFrames[propName].filter(
                kf => kf.frame !== frame
            );

            // Clean up empty keyframe arrays
            if (component.keyFrames[propName].length === 0) {
                delete component.keyFrames[propName];
            }
        },

        /**
         * Clear all keyframes for a property
         */
        clearPropertyKeyFrames(
            state,
            action: PayloadAction<{
                componentId: string;
                propName: string;
            }>
        ) {
            const { componentId, propName } = action.payload;
            const component = state.byId[componentId];
            if (!component) return;

            delete component.keyFrames[propName];
        },

        /**
         * Interpolate and update a single component's props based on current frame
         * This is called by AnimationPlayer for each active GameObject's components
         */
        interpolateComponentProps(
            state,
            action: PayloadAction<{ componentId: string; currentFrame: number }>
        ) {
            const { componentId, currentFrame } = action.payload;
            const component = state.byId[componentId];
            if (!component) return;

            // Interpolate each property that has keyframes
            for (const propName in component.keyFrames) {
                const keyFrames = component.keyFrames[propName];
                if (keyFrames.length === 0) continue;

                const interpolatedValue = interpolatePropertyValue(keyFrames, currentFrame);
                if (interpolatedValue !== undefined) {
                    component.props[propName] = interpolatedValue;
                }
            }
        }
    }
});

/**
 * Linear interpolation for property values
 * Supports: numbers, vectors (objects with numeric values), arrays
 */
function interpolatePropertyValue(keyFrames: PropertyKeyFrame[], currentFrame: number): any {
    if (keyFrames.length === 0) return undefined;

    // If only one keyframe, return its value
    if (keyFrames.length === 1) {
        return keyFrames[0].value;
    }

    // Find the two keyframes to interpolate between
    let prevKeyFrame: PropertyKeyFrame | null = null;
    let nextKeyFrame: PropertyKeyFrame | null = null;

    for (let i = 0; i < keyFrames.length; i++) {
        const kf = keyFrames[i];

        if (kf.frame === currentFrame) {
            // Exact match - return the keyframe value
            return kf.value;
        }

        if (kf.frame < currentFrame) {
            prevKeyFrame = kf;
        } else if (kf.frame > currentFrame && !nextKeyFrame) {
            nextKeyFrame = kf;
            break;
        }
    }

    // Before first keyframe - use first keyframe value
    if (!prevKeyFrame) {
        return keyFrames[0].value;
    }

    // After last keyframe - use last keyframe value
    if (!nextKeyFrame) {
        return keyFrames[keyFrames.length - 1].value;
    }

    // Interpolate between prevKeyFrame and nextKeyFrame
    const t = (currentFrame - prevKeyFrame.frame) / (nextKeyFrame.frame - prevKeyFrame.frame);

    return lerp(prevKeyFrame.value, nextKeyFrame.value, t);
}

/**
 * Linear interpolation between two values
 * Supports: numbers, vectors (objects), arrays
 */
function lerp(a: any, b: any, t: number): any {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // Number
    if (typeof a === 'number' && typeof b === 'number') {
        return a + (b - a) * t;
    }

    // Boolean - no interpolation, return the next value if t > 0.5
    if (typeof a === 'boolean' && typeof b === 'boolean') {
        return t < 0.5 ? a : b;
    }

    // String - no interpolation, return the next value if t > 0.5
    if (typeof a === 'string' && typeof b === 'string') {
        return t < 0.5 ? a : b;
    }

    // Vector/Object (e.g., {x: 1, y: 2, z: 3})
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
        // Array
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return t < 0.5 ? a : b;
            return a.map((val, i) => lerp(val, b[i], t));
        }

        // Object with numeric properties
        const result: any = {};
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);

        // Only interpolate if both objects have the same keys
        if (keysA.length === keysB.length && keysA.every(key => keysB.includes(key))) {
            for (const key of keysA) {
                result[key] = lerp(a[key], b[key], t);
            }
            return result;
        }

        // Different structure - return the next value
        return t < 0.5 ? a : b;
    }

    // Unsupported type - return the next value
    return t < 0.5 ? a : b;
}

export const {
    createComponent,
    deleteComponent,
    setComponentEnabled,
    updateComponentProps,
    reparentComponent,
    setPropertyKeyFrame,
    removePropertyKeyFrame,
    clearPropertyKeyFrames,
    interpolateComponentProps
} = componentSlice.actions;

export default componentSlice.reducer;

/**
 * Utility function to interpolate a single component
 * This can be called directly from AnimationPlayer without dispatching an action
 *
 * @param component - The component to interpolate
 * @param currentFrame - The frame to interpolate to
 * @returns The interpolated props (new object)
 */
export function interpolateComponent(component: ComponentSlice, currentFrame: number): Record<string, any> {
    const interpolatedProps = { ...component.props };

    // Interpolate each property that has keyframes
    for (const propName in component.keyFrames) {
        const keyFrames = component.keyFrames[propName];
        if (keyFrames.length === 0) continue;

        const interpolatedValue = interpolatePropertyValue(keyFrames, currentFrame);
        if (interpolatedValue !== undefined) {
            interpolatedProps[propName] = interpolatedValue;
        }
    }

    return interpolatedProps;
}
