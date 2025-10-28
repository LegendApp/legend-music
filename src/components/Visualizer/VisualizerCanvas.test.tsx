import React from "react";
import renderer, { act } from "react-test-renderer";

import { VisualizerCanvas } from "./VisualizerCanvas";

const mockConfigureVisualizer = jest.fn(() => Promise.resolve({ success: true }));
const mockRemove = jest.fn();
const mockAddListener = jest.fn((event: string, handler: (payload: any) => void) => {
    listeners[event] = handler;
    return {
        remove: mockRemove,
    };
});

const listeners: Record<string, (payload: any) => void> = {};

jest.mock("@/native-modules/AudioPlayer", () => {
    return {
        useAudioPlayer: () => ({
            configureVisualizer: mockConfigureVisualizer,
            addListener: mockAddListener,
        }),
    };
});

jest.mock("@shopify/react-native-skia", () => {
    const React = require("react");
    return {
        Canvas: (props: any) => <canvas {...props} />,
        Rect: (props: any) => <div data-testid="Rect" {...props} />,
        Group: (props: any) => <div data-testid="Group" {...props} />,
        Path: (props: any) => <path {...props} />,
        LinearGradient: (props: any) => <linearGradient {...props} />,
        PaintStyle: { Fill: "fill", Stroke: "stroke" },
        Skia: {
            Paint: () => {
                return {
                    setStyle: jest.fn(),
                    setAntiAlias: jest.fn(),
                    setStrokeWidth: jest.fn(),
                    setColor: jest.fn(),
                    setShader: jest.fn(),
                    setAlphaf: jest.fn(),
                };
            },
            Shader: {
                MakeLinearGradient: jest.fn(() => ({})),
            },
            Color: (value: string) => value,
            XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
        },
        TileMode: { Clamp: "clamp" },
        useDrawCallback: (callback: any) => callback,
        useValue: (initial: any) => ({ current: initial }),
        vec: (x: number, y: number) => ({ x, y }),
    };
});

describe("VisualizerCanvas", () => {
    beforeEach(() => {
        mockConfigureVisualizer.mockClear();
        mockAddListener.mockClear();
        mockRemove.mockClear();
        Object.keys(listeners).forEach((key) => delete listeners[key]);
    });

    it("enables the visualizer on mount and disables on unmount", async () => {
        let component: renderer.ReactTestRenderer | undefined;

        await act(async () => {
            component = renderer.create(<VisualizerCanvas />);
            await Promise.resolve();
        });

        expect(mockConfigureVisualizer).toHaveBeenCalledWith({
            enabled: true,
            binCount: 64,
            fftSize: 1024,
            smoothing: 0.6,
            throttleMs: 33,
        });

        await act(async () => {
            component?.unmount();
            await Promise.resolve();
        });

        expect(mockConfigureVisualizer).toHaveBeenLastCalledWith({ enabled: false });
        expect(mockRemove.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("handles incoming frames without crashing", async () => {
        let component: renderer.ReactTestRenderer | undefined;

        await act(async () => {
            component = renderer.create(<VisualizerCanvas binCount={32} />);
            await Promise.resolve();
        });

        const listener = listeners.onVisualizerFrame;
        expect(listener).toBeDefined();

        act(() => {
            listener?.({ bins: [], rms: 0, timestamp: Date.now() });
            listener?.({ bins: Array.from({ length: 32 }, (_, index) => index / 32), rms: 0.5, timestamp: Date.now() });
        });

        await act(async () => {
            component?.unmount();
            await Promise.resolve();
        });
    });
});
