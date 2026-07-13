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

  const CONFIG = {
    staticLayers: [assetUrl("static1.png"), assetUrl("static2.png")],
    dropImages: [
      assetUrl("drop1.png"),
      assetUrl("drop2.png"),
      assetUrl("drop3.png"),
      assetUrl("drop4.png"),
    ],
    dropCount: useMobileAssets ? 18 : 28,
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
      maxRotation: 9.5,
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
        activePointerId: null,
        activeTouchId: null,
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
        for (const url of urls) {
          await this.preloadImage(url);
        }
      },

      preloadImage(url, attempt = 0) {
        return new Promise(resolve => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve();
          image.onerror = () => {
            if (attempt < 2) {
              window.setTimeout(
                () => resolve(this.preloadImage(url, attempt + 1)),
                160
              );
              return;
            }
            console.warn(`Rain asset could not be preloaded: ${url}`);
            resolve();
          };
          image.src = attempt ? `${url}?retry=${attempt}` : url;
        });
      },

      startRain() {
        this.rainStartedAt = performance.now();
        const tick = now => {
          this.animationTime = now;
          if (!this.reducedMotion) {
            this.rainFrameId = requestAnimationFrame(tick);
          }
        };
        tick(this.rainStartedAt);
      },

      createFallingDrops() {
        return Array.from({ length: CONFIG.dropCount }, (_, index) => ({
          id: `drop-${index}`,
          src: CONFIG.dropImages[Math.floor(Math.random() * CONFIG.dropImages.length)],
          x: 0.02 + Math.random() * 0.96,
          rotation: -12 + Math.random() * 24,
          baseScale: 0.46 + Math.random() * 0.42,
          fallDuration: 5800 + Math.random() * 7200,
          fallOffset: Math.random(),
          phase: Math.random() * Math.PI * 2,
        }));
      },

      clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), maximum);
      },

      smoothStep(value) {
        const x = this.clamp(value, 0, 1);
        return x * x * (3 - 2 * x);
      },

      dropY(drop) {
        if (this.reducedMotion) {
          return 0.1 + drop.fallOffset * 0.8;
        }
        const elapsed = (this.animationTime - this.rainStartedAt) / drop.fallDuration;
        const progress = (elapsed + drop.fallOffset) % 1;
        return -0.16 + progress * 1.34;
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

      collisionInfluence(x, y, targets, radius) {
        return targets.reduce((impact, target) => {
          const distance = Math.hypot(x - target.x, y - target.y);
          return Math.max(impact, this.smoothStep(1 - distance / radius));
        }, 0);
      },

      leafCollision(leaf) {
        const drops = this.drops.map(drop => ({ x: drop.x, y: this.dropY(drop) }));
        return this.collisionInfluence(leaf.anchorX, leaf.anchorY, drops, 0.085);
      },

      dropCollision(drop, y) {
        const leaves = this.leaves.map(leaf => ({ x: leaf.anchorX, y: leaf.anchorY }));
        return this.collisionInfluence(drop.x, y, leaves, 0.085);
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
        const pointerImpact = this.distanceInfluence(drop.x, y, effect.radius);
        const collision = this.dropCollision(drop, y);
        const wave = Math.sin(this.animationTime / 35 + drop.phase) * collision;
        const scale = drop.baseScale * (1 + pointerImpact * (effect.activeScale - 1));
        const opacity = (effect.baseOpacity + pointerImpact * (effect.activeOpacity - effect.baseOpacity)) * this.dropVisibility(y);
        const saturation = effect.baseSaturation + pointerImpact * (effect.activeSaturation - effect.baseSaturation);
        const brightness = effect.baseBrightness + pointerImpact * (effect.activeBrightness - effect.baseBrightness);

        return {
          left: `${drop.x * 100}%`,
          top: `${y * 100}%`,
          opacity,
          filter: `saturate(${saturation}) brightness(${brightness})`,
          transform: `translate(calc(-50% + ${wave * 2}px), calc(-50% + ${Math.abs(wave) * 1.5}px)) rotate(${drop.rotation + wave * 3}deg) scale(${scale})`,
        };
      },

      leafStyle(leaf) {
        const pointerImpact = this.distanceInfluence(leaf.anchorX, leaf.anchorY, leaf.radius);
        const horizontalOffset = this.clamp((this.pointer.x - leaf.anchorX) / leaf.radius, -1, 1);
        const collision = this.leafCollision(leaf);
        const wave = Math.sin(this.animationTime / 35 + leaf.originX) * collision;
        const rotation = pointerImpact * leaf.maxRotation * horizontalOffset * leaf.direction + wave * 3.2;

        return {
          transformOrigin: `${leaf.originX}% ${leaf.originY}%`,
          transform: `translate(${wave * 1.5}px, ${Math.abs(wave) * 1.8}px) rotate(${rotation}deg)`,
        };
      },
    },
  }).mount(appElement);
})();