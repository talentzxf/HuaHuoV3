import React from 'react';
import {Layout, Model, TabNode, IJsonModel} from 'flexlayout-react';
import 'flexlayout-react/style/dark.css';
import '../styles/flexlayout-custom.css';
import Counter from './Counter';
import HomePanel from './panels/HomePanel';
import AppsPanel from './panels/AppsPanel';
import SettingsPanel from './panels/SettingsPanel';
import PropertyPanel from "@/components/panels/PropertyPanel";
import LogsPanel from './panels/LogsPanel';
import CanvasPanel from './panels/CanvasPanel';
import HierarchyPanel from './panels/HierarchyPanel';

interface FlexLayoutWrapperProps {
}

// FlexLayout configuration
const json: IJsonModel = {
    global: {
        tabEnableClose: true,
        tabEnableRename: false,
        tabSetEnableMaximize: true,
        tabSetEnableDrop: true,
        tabSetEnableDrag: true,
        tabSetEnableDivide: true,
        tabEnableDrag: true,
        tabDragSpeed: 0.3,
        tabEnableRenderOnDemand: false,
    },
    borders: [],
    layout: {
        type: 'row',
        weight: 100,
        children: [
            {
                type: 'column',
                weight: 100,
                children: [
                    {
                        type: 'row',
                        weight: 75,
                        children: [
                            {
                                type: 'tabset',
                                weight: 15,
                                children: [
                                    {
                                        type:'tab',
                                        name: '📋 Hierarchy',
                                        component: 'hierarchy',
                                    }
                                ],
                            },
                            {
                                type: 'tabset',
                                weight: 70,
                                children: [
                                    {
                                        type: 'tab',
                                        name: '🎨 Canvas',
                                        component: 'canvas',
                                    },
                                    {
                                        type: 'tab',
                                        name: '📱 Apps',
                                        component: 'apps',
                                    },
                                    {
                                        type: 'tab',
                                        name: '⚙️ Settings',
                                        component: 'settings',
                                    },
                                    {
                                        type: 'tab',
                                        name: '🏠 Home',
                                        component: 'home',
                                    },
                                    {
                                        type: 'tab',
                                        name: '🔢 Counter',
                                        component: 'counter',
                                    },
                                ],
                            },
                            {
                                type: 'tabset',
                                weight: 15,
                                children: [
                                    {
                                        type:'tab',
                                        name: '🏠 Properties',
                                        component: 'property',
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        type: 'tabset',
                        weight: 25,
                        children: [
                            {
                                type: 'tab',
                                name: '📋 Logs',
                                component: 'logs',
                                enableClose: false,
                            }
                        ],
                    },
                ],
            },
        ],
    },
};

const FlexLayoutWrapper: React.FC<FlexLayoutWrapperProps> = () => {
    const model = React.useMemo(() => Model.fromJson(json), []);

    // Factory function to render components
    const factory = (node: TabNode) => {
        const component = node.getComponent();

        switch (component) {
            case 'canvas':
                return <CanvasPanel/>;
            case 'hierarchy':
                return <HierarchyPanel/>;
            case 'home':
                return <HomePanel/>;
            case 'counter':
                return <Counter/>;
            case 'apps':
                return <AppsPanel/>;
            case 'settings':
                return <SettingsPanel/>;
            case 'property':
                return <PropertyPanel/>;
            case 'logs':
                return <LogsPanel/>;
            default:
                return <div>Component not found: {component}</div>;
        }
    };

    return (
        <div
            style={{
                width: '100%',
                height: 'calc(100vh - 48px)',
                position: 'absolute',
                top: '48px',
                left: 0,
                right: 0,
                bottom: 0,
            }}
        >
            <Layout
                model={model}
                factory={factory}
            />
        </div>
    );
};

export default FlexLayoutWrapper;

