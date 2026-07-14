(() => {
  "use strict";

  const appElement = document.getElementById("rain-app");
  if (!appElement || !window.Vue) {
    console.error("Rain app or Vue was not found.");
    return;
  }

  const { createApp } = window.Vue;
  const rootPath = appElement.dataset.root.endsWith("/")
    ? appElement.dataset.root
    : `${appElement.dataset.root}/`;
  const useMobileAssets = window.matchMedia("(max-width: 700px)").matches;
  const assetUrl = filename =>
    `${rootPath}${useMobileAssets ? "mobile/" : ""}${filename}`;
  const alphaMasks = new Map();

  const CONFIG = {
    staticLayers: [assetUrl("static1.png"), assetUrl("static2.png")],
    dropImages: [
      assetUrl("drop1.png"),
      assetUrl("drop2.png"),
      assetUrl("drop3.png"),
      assetUrl("drop4.png"),
    ],
    dropCount: useMobileAssets ? 18 : 28,
    maxDropMultiplier: 5,
    dropGrowthInterval: 12000,
    collisionCheckInterval: 3000,
    dropEffect: {
      radius: 0.4,
      baseOpacity: 0.48,
      activeOpacity: 1,
      baseSaturation: 0.65,
      activeSaturation: 1.65,
      baseBrightness: 0.92,
      activeBrightness: 1.1,
      activeScale: 1.08,
    },
    leaves: [
      { src: assetUrl("leaf1.png"), anchorX: 0.75, anchorY: 0.68, originX: 75, originY: 68, direction: 1 },
      { src: assetUrl("leaf2.png"), anchorX: 0.58, anchorY: 0.89, originX: 58, originY: 89, direction: -1 },
      { src: assetUrl("leaf3.png"), anchorX: 0.85, anchorY: 0.36, originX: 85, originY: 36, direction: 1 },
      { src: assetUrl("leaf4.png"), anchorX: 0.84, anchorY: 0.44, originX: 84, originY: 44, direction: -1 },
      { src: assetUrl("leaf5.png"), anchorX: 0.58, anchorY: 0.5, originX: 58, originY: 50, direction: 1 },
      { src: assetUrl("leaf6.png"), anchorX: 0.65, anchorY: 0.7, originX: 65, originY: 70, direction: -1 },
      { src: assetUrl("leaf7.png"), anchorX: 0.43, anchorY: 0.74, originX: 43, originY: 74, direction: -1 },
      { src: assetUrl("leaf8.png"), anchorX: 0.51, anchorY: 0.65, originX: 51, originY: 65, direction: 1 },
      { src: assetUrl("leaf9.png"), anchorX: 0.44, anchorY: 0.55, originX: 44, originY: 55, direction: 1 },
      { src: assetUrl("leaf10.png"), anchorX: 0.34, anchorY: 0.57, originX: 34, originY: 57, direction: -1 },
      { src: assetUrl("leaf11.png"), anchorX: 0.32, anchorY: 0.575, originX: 32, originY: 57, direction: 1 },
      { src: assetUrl("leaf12.png"), anchorX: 0.34, anchorY: 0.7, originX: 34, originY: 70, direction: -1 },
      { src: assetUrl("leaf13.png"), anchorX: 0.15, anchorY: 0.53, originX: 15, originY: 53, direction: 1 },
    ].map((leaf, index) => ({
      ...leaf,
      id: `leaf-${index + 1}`,
      radius: 0.47,
      maxRotation: 6.5,
    })),
  };

  createApp({
    data() {
      return {
        staticLayers: CONFIG.staticLayers,
        leaves: CONFIG.leaves,
        drops: [],
        ready: false,
        pointer: { x: 0.5, y: 0.5, active: false },
        pendingPointer: null,
        pointerFrameId: null,
        rainFrameId: null,
        animationTime: 0,
        rainStartedAt: 0,
        lastAnimationTime: 0,
        activePointerId: null,
        activeTouchId: null,
        leafShakes: {},
        dropShakes: {},
        leafCollisionCheckAt: {},
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    },

    mounted() {
      window.setTimeout(() => this.initializeScene(), 120);
    },

    beforeUnmount() {
      if (this.pointerFrameId !== null) {
        cancelAnimationFrame(this.pointerFrameId);
      }
      if (this.rainFrameId !== null) {
        cancelAnimationFrame(this.rainFrameId);
      }
    },

    methods: {
      async initializeScene() {
        await this.preloadAssets();
        this.drops = this.createFallingDrops();
        this.ready = true;
        this.$nextTick(() => this.startRain());
      },

      async preloadAssets() {
        const urls = [
          ...CONFIG.staticLayers,
          ...CONFIG.leaves.map(leaf => leaf.src),
          ...CONFIG.dropImages,
        ];
        const images = new Map();
        for (const url of urls) {
          const image = await this.preloadImage(url);
          if (image) {
            images.set(url, image);
          }
        }
        this.buildAlphaMasks(images);
      },

      preloadImage(url, attempt = 0) {
        return new Promise(resolve => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve(image);
          image.onerror = () => {
            if (attempt < 2) {
              window.setTimeout(
                () => resolve(this.preloadImage(url, attempt + 1)),
                160
              );
              return;
            }
            console.warn(`Rain asset could not be preloaded: ${url}`);
            resolve(null);
          };
          image.src = attempt ? `${url}?retry=${attempt}` : url;
        });
      },

      buildAlphaMasks(images) {
        images.forEach((image, url) => {
          if (!CONFIG.dropImages.includes(url) && !CONFIG.leaves.some(leaf => leaf.src === url)) {
            return;
          }
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, 320 / image.naturalWidth);
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const candidates = [];

          for (let y = 0; y < canvas.height; y += 10) {
            for (let x = 0; x < canvas.width; x += 10) {
              const alpha = pixels[(y * canvas.width + x) * 4 + 3];
              if (alpha > 80 && CONFIG.dropImages.includes(url)) {
                candidates.push({ x: (x + 0.5) / canvas.width, y: (y + 0.5) / canvas.height });
              }
            }
          }

          alphaMasks.set(url, {
            width: canvas.width,
            height: canvas.height,
            pixels,
            samples: candidates.filter((_, index) => index % Math.max(1, Math.ceil(candidates.length / 96)) === 0),
          });
        });
      },

      startRain() {
        this.rainStartedAt = performance.now();
        this.drops.forEach(drop => {
          drop.startedAt = this.rainStartedAt;
        });
        this.leaves.forEach((leaf, index) => {
          this.leafCollisionCheckAt[leaf.id] = this.rainStartedAt +
            index * CONFIG.collisionCheckInterval / this.leaves.length;
        });
        const tick = now => {
          this.animationTime = now;
          this.addDropsOverTime(now);
          this.advanceDrops(now);
          this.updateCollisions(now);
          if (!this.reducedMotion) {
            this.rainFrameId = requestAnimationFrame(tick);
          }
        };
        tick(this.rainStartedAt);
      },

      createFallingDrops(count = CONFIG.dropCount, startedAt = null, firstId = 0) {
        return Array.from({ length: count }, (_, index) => ({
          id: `drop-${firstId + index}`,
          src: CONFIG.dropImages[Math.floor(Math.random() * CONFIG.dropImages.length)],
          x: 0.02 + Math.random() * 0.96,
          rotation: -12 + Math.random() * 24,
          baseScale: 0.46 + Math.random() * 0.42,
          fallDuration: 5800 + Math.random() * 7200,
          fallOffset: startedAt === null ? Math.random() : 0,
          startedAt,
          phase: Math.random() * Math.PI * 2,
          offsetX: 0,
          deflectVelocity: 0,
          lastProgress: null,
        }));
      },

      addDropsOverTime(now) {
        if (this.reducedMotion) {
          return;
        }

        const stages = Math.floor((now - this.rainStartedAt) / CONFIG.dropGrowthInterval);
        const maximum = CONFIG.dropCount * CONFIG.maxDropMultiplier;
        const target = Math.min(maximum, CONFIG.dropCount * (1 + stages));
        if (target <= this.drops.length) {
          return;
        }

        this.drops.push(...this.createFallingDrops(target - this.drops.length, now, this.drops.length));
      },

      clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
      },

      smoothStep(value) {
        const x = this.clamp(value, 0, 1);
        return x * x * (3 - 2 * x);
      },

      dropProgress(drop) {
        if (this.reducedMotion) {
          return drop.fallOffset;
        }
        const elapsed = (this.animationTime - (drop.startedAt ?? this.rainStartedAt)) / drop.fallDuration;
        return (elapsed + drop.fallOffset) % 1;
      },

      dropY(drop) {
        return -0.16 + this.dropProgress(drop) * 1.34;
      },

      dropX(drop) {
        return drop.x + drop.offsetX;
      },

      advanceDrops(now) {
        const elapsedSeconds = this.lastAnimationTime
          ? (now - this.lastAnimationTime) / 1000
          : 0;
        this.lastAnimationTime = now;

        for (const drop of this.drops) {
          const progress = this.dropProgress(drop);
          if (drop.lastProgress !== null && progress < drop.lastProgress) {
            drop.offsetX = 0;
            drop.deflectVelocity = 0;
          }
          drop.lastProgress = progress;
          drop.offsetX = this.clamp(drop.offsetX + drop.deflectVelocity * elapsedSeconds, -0.08, 0.08);
          drop.deflectVelocity *= Math.pow(0.06, elapsedSeconds);
        }
      },

      dropVisibility(y) {
        return this.smoothStep((y + 0.16) / 0.12) *
          this.smoothStep((1.18 - y) / 0.12);
      },

      distanceInfluence(x, y, radius) {
        if (!this.pointer.active) {
          return 0;
        }
        return this.smoothStep(1 - Math.hypot(x - this.pointer.x, y - this.pointer.y) / radius);
      },

      alphaAt(mask, x, y) {
        if (!mask || x < 0 || x > 1 || y < 0 || y > 1) {
          return 0;
        }
        const column = Math.min(mask.width - 1, Math.floor(x * mask.width));
        const row = Math.min(mask.height - 1, Math.floor(y * mask.height));
        return mask.pixels[(row * mask.width + column) * 4 + 3];
      },

      dropDisplaySize(drop) {
        const mask = alphaMasks.get(drop.src);
        const sceneWidth = this.$refs.scene?.clientWidth || 1;
        const cssWidth = sceneWidth * (useMobileAssets ? 0.2 : 0.28);
        const width = Math.min(110, Math.max(30, cssWidth)) / sceneWidth;
        return { width, height: width * mask.height / mask.width };
      },

      findAlphaCollision(drop, y, leaf) {
        const dropMask = alphaMasks.get(drop.src);
        const leafMask = alphaMasks.get(leaf.src);
        if (!dropMask?.samples.length || !leafMask) {
          return null;
        }

        const { width, height } = this.dropDisplaySize(drop);
        const x = this.dropX(drop);
        for (const sample of dropMask.samples) {
          const hitX = x + (sample.x - 0.5) * width;
          const hitY = y + (sample.y - 0.5) * height;
          if (this.alphaAt(leafMask, hitX, hitY) > 80) {
            return { x: hitX, y: hitY };
          }
        }
        return null;
      },

      updateCollisions(now) {
        for (const leaf of this.leaves) {
          const nextCheck = this.leafCollisionCheckAt[leaf.id] ?? now;
          if (now < nextCheck) {
            continue;
          }

          this.leafCollisionCheckAt[leaf.id] = now + CONFIG.collisionCheckInterval;
          if (this.distanceInfluence(leaf.anchorX, leaf.anchorY, leaf.radius) > 0.02) {
            continue;
          }

          for (const drop of this.drops) {
            const y = this.dropY(drop);
            if (y < 0 || y > 1) {
              continue;
            }

            const hit = this.findAlphaCollision(drop, y, leaf);
            if (!hit) {
              continue;
            }

            const originX = leaf.originX / 100;
            const originY = leaf.originY / 100;
            const distance = Math.hypot(hit.x - originX, hit.y - originY);
            const direction = hit.x >= this.dropX(drop) ? -1 : 1;
            this.leafShakes[leaf.id] = { at: now, amplitude: 1.2 + distance * 16 };
            this.dropShakes[drop.id] = { at: now, amplitude: 2.2 };
            drop.deflectVelocity = direction * (0.015 + distance * 0.045);
            break;
          }
        }
      },
      shakeValue(shake, phase) {
        if (!shake) {
          return 0;
        }

        const elapsed = this.animationTime - shake.at;
        if (elapsed < 0 || elapsed > 560) {
          return 0;
        }

        const progress = elapsed / 560;
        return Math.sin(progress * Math.PI * 3 + phase) * (1 - progress) * shake.amplitude;
      },

      portraitRevealStyle() {
        const edgeDistance = Math.min(
          this.pointer.x,
          1 - this.pointer.x,
          this.pointer.y,
          1 - this.pointer.y
        );
        return {
          opacity: this.pointer.active ? 0.92 * this.smoothStep(edgeDistance / 0.08) : 0,
          "--reveal-x": `${this.pointer.x * 100}%`,
          "--reveal-y": `${this.pointer.y * 100}%`,
        };
      },

      updatePointer(event) {
        this.updatePointerPosition(event.clientX, event.clientY);
      },

      updatePointerPosition(clientX, clientY) {
        const scene = this.$refs.scene;
        if (!scene) {
          return;
        }
        const rect = scene.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        this.pendingPointer = {
          x: this.clamp((clientX - rect.left) / rect.width, 0, 1),
          y: this.clamp((clientY - rect.top) / rect.height, 0, 1),
        };
        if (this.pointerFrameId !== null) {
          return;
        }
        this.pointerFrameId = requestAnimationFrame(() => {
          this.pointer.x = this.pendingPointer.x;
          this.pointer.y = this.pendingPointer.y;
          this.pointer.active = true;
          this.pointerFrameId = null;
        });
      },

      onTouchStart(event) {
        const touch = event.touches[0];
        if (!touch) {
          return;
        }
        this.activeTouchId = touch.identifier;
        this.updatePointerPosition(touch.clientX, touch.clientY);
      },

      onTouchMove(event) {
        const touch = Array.from(event.touches).find(item => item.identifier === this.activeTouchId);
        if (touch) {
          this.updatePointerPosition(touch.clientX, touch.clientY);
        }
      },

      onTouchEnd(event) {
        if (Array.from(event.changedTouches).some(item => item.identifier === this.activeTouchId)) {
          this.activeTouchId = null;
          this.pointer.active = false;
        }
      },

      onPointerDown(event) {
        this.activePointerId = event.pointerId;
        this.$refs.scene.setPointerCapture?.(event.pointerId);
        this.updatePointer(event);
      },

      onPointerMove(event) {
        if (event.pointerType !== "mouse" && this.activePointerId !== event.pointerId) {
          return;
        }
        this.updatePointer(event);
      },

      onPointerLeave(event) {
        if (event.pointerType === "mouse") {
          this.pointer.active = false;
        }
      },

      onPointerEnd(event) {
        if (this.activePointerId !== event.pointerId) {
          return;
        }
        if (this.$refs.scene.hasPointerCapture?.(event.pointerId)) {
          this.$refs.scene.releasePointerCapture(event.pointerId);
        }
        this.activePointerId = null;
        this.pointer.active = false;
      },

      dropStyle(drop) {
        const effect = CONFIG.dropEffect;
        const y = this.dropY(drop);
        const x = this.dropX(drop);
        const pointerImpact = this.distanceInfluence(x, y, effect.radius);
        const shake = this.shakeValue(this.dropShakes[drop.id], drop.phase);
        const scale = drop.baseScale * (1 + pointerImpact * (effect.activeScale - 1));
        const opacity = (effect.baseOpacity + pointerImpact * (effect.activeOpacity - effect.baseOpacity)) * this.dropVisibility(y);
        const saturation = effect.baseSaturation + pointerImpact * (effect.activeSaturation - effect.baseSaturation);
        const brightness = effect.baseBrightness + pointerImpact * (effect.activeBrightness - effect.baseBrightness);

        return {
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          opacity,
          filter: `saturate(${saturation}) brightness(${brightness})`,
          transform: `translate(-50%, -50%) rotate(${drop.rotation + shake}deg) scale(${scale * (1 + Math.abs(shake) * 0.02)})`,
        };
      },

      leafStyle(leaf) {
        const pointerImpact = this.distanceInfluence(leaf.anchorX, leaf.anchorY, leaf.radius);
        const horizontalOffset = this.clamp((this.pointer.x - leaf.anchorX) / leaf.radius, -1, 1);
        const shake = pointerImpact > 0.02
          ? 0
          : this.shakeValue(this.leafShakes[leaf.id], leaf.originX);
        const rotation = pointerImpact * leaf.maxRotation * horizontalOffset * leaf.direction + shake;

        return {
          transformOrigin: `${leaf.originX}% ${leaf.originY}%`,
          transform: `rotate(${rotation}deg)`,
        };
      },
    },
  }).mount(appElement);
})();