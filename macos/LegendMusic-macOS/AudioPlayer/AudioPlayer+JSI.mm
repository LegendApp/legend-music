#import "AudioPlayer+JSI.h"
#import "AudioPlayer.h"

#import <React/RCTBridge+Private.h>
#import <React/RCTSurfacePresenterBridgeAdapter.h>
#import <dispatch/dispatch.h>

#import <jsi/jsi.h>

#include <mutex>
#include <unordered_map>
#include <vector>
#include <cstring>

using namespace facebook;
using namespace facebook::jsi;

namespace {

struct VisualizerMutableBuffer : MutableBuffer {
    explicit VisualizerMutableBuffer(size_t byteCapacity)
        : storage(byteCapacity) {}

    size_t size() const override {
        return storage.size();
    }

    uint8_t *data() override {
        return storage.data();
    }

    std::vector<uint8_t> storage;
};

struct VisualizerJSIState {
    std::mutex mutex;
    std::shared_ptr<VisualizerMutableBuffer> buffer;
    size_t stride = sizeof(float);
    size_t binCount = 0;
    float rms = 0;
    double timestamp = 0;
    bool installed = false;
};

std::unordered_map<AudioPlayer *, std::shared_ptr<VisualizerJSIState>> &stateMap() {
    static auto *map = new std::unordered_map<AudioPlayer *, std::shared_ptr<VisualizerJSIState>>();
    return *map;
}

std::mutex &stateMapMutex() {
    static auto *mutex = new std::mutex();
    return *mutex;
}

std::shared_ptr<VisualizerJSIState> ensureState(AudioPlayer *player) {
    if (!player) {
        return nullptr;
    }

    std::lock_guard<std::mutex> guard(stateMapMutex());
    auto &map = stateMap();
    auto iterator = map.find(player);
    if (iterator != map.end()) {
        return iterator->second;
    }

    auto state = std::make_shared<VisualizerJSIState>();
    map[player] = state;
    return state;
}

void removeState(AudioPlayer *player) {
    if (!player) {
        return;
    }
    std::lock_guard<std::mutex> guard(stateMapMutex());
    stateMap().erase(player);
}

std::shared_ptr<VisualizerMutableBuffer> ensureBuffer(
    const std::shared_ptr<VisualizerJSIState> &state,
    size_t requiredBytes) {
    if (!state) {
        return nullptr;
    }

    if (!state->buffer || state->buffer->size() < requiredBytes) {
        size_t capacity = 1;
        while (capacity < requiredBytes) {
            capacity <<= 1;
        }
        state->buffer = std::make_shared<VisualizerMutableBuffer>(capacity);
    }
    return state->buffer;
}

facebook::react::RuntimeExecutor runtimeExecutorForBridge(RCTBridge *bridge) {
    if (!bridge) {
        return nullptr;
    }
    return RCTRuntimeExecutorFromBridge(bridge);
}

bool installBindingsOnRuntime(
    Runtime &runtime,
    const std::shared_ptr<VisualizerJSIState> &state) {
    if (!state) {
        return false;
    }

    std::lock_guard<std::mutex> guard(state->mutex);
    state->installed = true;

    auto global = runtime.global();
    jsi::Object module(runtime);

    if (global.hasProperty(runtime, "LegendAudioVisualizer")) {
        auto value = global.getProperty(runtime, "LegendAudioVisualizer");
        if (value.isObject()) {
            module = value.getObject(runtime);
        }
    }

    auto hostFunction = Function::createFromHostFunction(
        runtime,
        PropNameID::forAscii(runtime, "getFrame"),
        0,
        [stateWeak = std::weak_ptr<VisualizerJSIState>(state)](
            Runtime &runtimeRef,
            const Value &,
            const Value *,
            size_t) -> Value {
            auto lockedState = stateWeak.lock();
            if (!lockedState) {
                return Value::undefined();
            }

            std::lock_guard<std::mutex> frameGuard(lockedState->mutex);
            if (!lockedState->installed || !lockedState->buffer || lockedState->binCount == 0) {
                return Value::undefined();
            }

            auto arrayBuffer = runtimeRef.createArrayBuffer(lockedState->buffer);
            auto float32Constructor = runtimeRef.global().getPropertyAsFunction(runtimeRef, "Float32Array");

            Value constructorArguments[] = {
                Value(runtimeRef, arrayBuffer),
                Value(0),
                Value(static_cast<double>(lockedState->binCount)),
            };

            auto typedArray =
                float32Constructor.callAsConstructor(runtimeRef, constructorArguments, std::size(constructorArguments));

            jsi::Object result(runtimeRef);
            result.setProperty(runtimeRef, "bins", std::move(typedArray));
            result.setProperty(runtimeRef, "binCount", static_cast<double>(lockedState->binCount));
            result.setProperty(runtimeRef, "rms", static_cast<double>(lockedState->rms));
            result.setProperty(runtimeRef, "timestamp", lockedState->timestamp);
            result.setProperty(runtimeRef, "stride", static_cast<double>(lockedState->stride));
            result.setProperty(runtimeRef, "format", "f32-le");

            return result;
        });

    module.setProperty(runtime, "getFrame", std::move(hostFunction));
    module.setProperty(runtime, "version", 1);
    module.setProperty(runtime, "stride", static_cast<double>(state->stride));

    global.setProperty(runtime, "LegendAudioVisualizer", std::move(module));
    return true;
}

} // namespace

void AudioPlayerScheduleVisualizerJSIInstallation(
    AudioPlayer *player,
    RCTPromiseResolveBlock resolve,
    RCTPromiseRejectBlock reject) {
    if (!resolve) {
        return;
    }

    if (!player || !player.bridge) {
        resolve(@{ @"installed": @NO });
        return;
    }

    auto state = ensureState(player);
    auto executor = runtimeExecutorForBridge(player.bridge);
    if (!executor) {
        resolve(@{ @"installed": @NO });
        return;
    }

    executor([state, resolveCopy = [resolve copy]](Runtime &runtime) mutable {
        bool installed = installBindingsOnRuntime(runtime, state);
        if (resolveCopy) {
            dispatch_async(dispatch_get_main_queue(), ^{
                resolveCopy(@{ @"installed": installed ? @YES : @NO });
            });
        }
    });
}

void AudioPlayerUpdateVisualizerJSIState(
    AudioPlayer *player,
    const float *bins,
    NSUInteger count,
    float rms,
    NSTimeInterval timestamp) {
    if (!player || !bins || count == 0) {
        return;
    }

    auto state = ensureState(player);
    if (!state) {
        return;
    }

    std::lock_guard<std::mutex> guard(state->mutex);
    if (!state->installed) {
        return;
    }

    size_t requiredBytes = static_cast<size_t>(count) * sizeof(float);
    auto buffer = ensureBuffer(state, requiredBytes);
    if (!buffer) {
        return;
    }

    std::memcpy(buffer->data(), bins, requiredBytes);
    state->binCount = count;
    state->rms = rms;
    state->timestamp = timestamp;
    state->stride = sizeof(float);
}

void AudioPlayerResetVisualizerJSIState(AudioPlayer *player) {
    if (!player) {
        return;
    }

    auto state = ensureState(player);
    if (!state) {
        return;
    }

    std::lock_guard<std::mutex> guard(state->mutex);
    state->binCount = 0;
    state->rms = 0;
    state->timestamp = 0;
    state->installed = false;
}
